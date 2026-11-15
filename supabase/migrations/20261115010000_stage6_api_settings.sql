-- Stage 6: server limits, atomic session reservations and request locking.

alter table public.settings
  rename column daily_token_budget_total to daily_token_budget_global;

alter table public.settings
  add column max_orders_length integer,
  add column defender_max_reply_tokens_ceiling integer,
  add column active_sessions_per_user_per_guard integer,
  add column message_rate_limit_per_user_per_minute integer;

alter table public.settings
  add constraint settings_orders_length_positive check (max_orders_length > 0),
  add constraint settings_defender_reply_ceiling_positive check (defender_max_reply_tokens_ceiling > 0),
  add constraint settings_active_sessions_positive check (active_sessions_per_user_per_guard > 0),
  add constraint settings_message_rate_positive check (message_rate_limit_per_user_per_minute > 0);

insert into public.settings (
  singleton,
  max_messages_per_session,
  max_message_length,
  max_orders_length,
  defender_max_reply_tokens_ceiling,
  session_time_limit_seconds,
  max_wrong_attempts,
  cooldown_seconds,
  sessions_per_user_per_guard_per_day,
  sessions_per_user_per_day,
  active_sessions_per_user_per_guard,
  daily_token_budget_global,
  daily_token_budget_per_user,
  message_rate_limit_per_user_per_minute,
  human_attacks_enabled,
  disabled_guard_ids
) values (
  true,
  12,
  500,
  2000,
  300,
  600,
  3,
  6,
  2,
  5,
  1,
  150000,
  30000,
  20,
  true,
  '{}'::uuid[]
)
on conflict (singleton) do update set
  max_messages_per_session = excluded.max_messages_per_session,
  max_message_length = excluded.max_message_length,
  max_orders_length = excluded.max_orders_length,
  defender_max_reply_tokens_ceiling = excluded.defender_max_reply_tokens_ceiling,
  session_time_limit_seconds = excluded.session_time_limit_seconds,
  max_wrong_attempts = excluded.max_wrong_attempts,
  cooldown_seconds = excluded.cooldown_seconds,
  sessions_per_user_per_guard_per_day = excluded.sessions_per_user_per_guard_per_day,
  sessions_per_user_per_day = excluded.sessions_per_user_per_day,
  active_sessions_per_user_per_guard = excluded.active_sessions_per_user_per_guard,
  daily_token_budget_global = excluded.daily_token_budget_global,
  daily_token_budget_per_user = excluded.daily_token_budget_per_user,
  message_rate_limit_per_user_per_minute = excluded.message_rate_limit_per_user_per_minute,
  human_attacks_enabled = excluded.human_attacks_enabled,
  disabled_guard_ids = excluded.disabled_guard_ids,
  updated_at = now();

alter table public.settings
  alter column max_messages_per_session set not null,
  alter column max_message_length set not null,
  alter column session_time_limit_seconds set not null,
  alter column cooldown_seconds set not null,
  alter column max_wrong_attempts set not null,
  alter column sessions_per_user_per_guard_per_day set not null,
  alter column sessions_per_user_per_day set not null,
  alter column daily_token_budget_global set not null,
  alter column daily_token_budget_per_user set not null,
  alter column max_orders_length set not null,
  alter column defender_max_reply_tokens_ceiling set not null,
  alter column active_sessions_per_user_per_guard set not null,
  alter column message_rate_limit_per_user_per_minute set not null;

alter table public.sessions
  add column processing_token uuid,
  add column processing_started_at timestamptz;

create or replace view public.guard_version_stats
with (security_barrier = true)
as
with ended_stats as (
  select
    s.guard_id,
    count(*) filter (where s.status = 'ended' and s.end_reason in ('cracked', 'held', 'expired')) as attempts,
    count(*) filter (where s.status = 'ended' and s.end_reason = 'cracked') as breaks,
    avg(s.picks_used) filter (where s.status = 'ended' and s.end_reason = 'cracked') as average_picks_to_crack,
    avg(s.picks_used) filter (where s.status = 'ended' and s.end_reason in ('cracked', 'held', 'expired')) as average_survival_picks
  from public.sessions as s
  group by s.guard_id
)
select
  g.id,
  g.family_id,
  g.version,
  g.name,
  g.look_seed,
  g.key_type,
  g.lock_type,
  g.reveal_key_format,
  g.created_at as posted_at,
  coalesce(e.attempts, 0)::integer as attempts,
  coalesce(e.breaks, 0)::integer as breaks,
  case when coalesce(e.attempts, 0) = 0 then null
    else e.breaks::numeric / e.attempts::numeric
  end as break_rate,
  round(e.average_picks_to_crack::numeric, 2) as average_picks_to_crack,
  round(e.average_survival_picks::numeric, 2) as average_survival_picks,
  g.published
from public.guards as g
left join ended_stats as e on e.guard_id = g.id
where g.published or g.owner_id = auth.uid();

comment on view public.guard_version_stats is
  'Published guard details plus private rows for their owner; exposes no instructions or owner identifiers.';

create table public.user_message_rate_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.user_message_rate_windows enable row level security;
revoke all on public.user_message_rate_windows from public, anon, authenticated;
grant all on public.user_message_rate_windows to service_role;

create or replace function public.enforce_guard_orders_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  order_limit integer;
begin
  select max_orders_length into order_limit
  from public.settings where singleton = true;

  if order_limit is not null and char_length(new.instructions) > order_limit then
    raise exception using errcode = 'P0001', message = 'ORDERS_TOO_LONG';
  end if;
  return new;
end;
$$;

create trigger guards_orders_length_limit
before insert on public.guards
for each row execute function public.enforce_guard_orders_limit();

create or replace function public.reserve_attack_session(
  p_session_id uuid,
  p_guard_id uuid,
  p_guard_family_id uuid,
  p_attacker_id uuid,
  p_secret text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  limits public.settings%rowtype;
  target_guard public.guards%rowtype;
  utc_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  user_sessions_today integer;
  guard_sessions_today integer;
  active_for_guard integer;
  global_tokens bigint;
  user_tokens bigint;
begin
  select * into limits from public.settings where singleton = true for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;

  if not limits.human_attacks_enabled then
    raise exception using errcode = 'P0001', message = 'HUMAN_ATTACKS_DISABLED';
  end if;

  select * into target_guard
  from public.guards
  where id = p_guard_id and family_id = p_guard_family_id and published;
  if not found then
    raise exception using errcode = 'P0001', message = 'GUARD_NOT_AVAILABLE';
  end if;
  if target_guard.owner_id = p_attacker_id then
    raise exception using errcode = 'P0001', message = 'CANNOT_ATTACK_OWN_GUARD';
  end if;
  if p_guard_id = any(limits.disabled_guard_ids) or p_guard_family_id = any(limits.disabled_guard_ids) then
    raise exception using errcode = 'P0001', message = 'GUARD_DISABLED';
  end if;

  select count(*) into user_sessions_today from public.sessions
  where attacker_id = p_attacker_id and created_at >= utc_day_start;
  if user_sessions_today >= limits.sessions_per_user_per_day then
    raise exception using errcode = 'P0001', message = 'USER_DAILY_SESSION_LIMIT';
  end if;

  select count(*) into guard_sessions_today from public.sessions
  where attacker_id = p_attacker_id
    and guard_family_id = p_guard_family_id
    and created_at >= utc_day_start;
  if guard_sessions_today >= limits.sessions_per_user_per_guard_per_day then
    raise exception using errcode = 'P0001', message = 'USER_GUARD_DAILY_SESSION_LIMIT';
  end if;

  select count(*) into active_for_guard from public.sessions
  where attacker_id = p_attacker_id
    and guard_family_id = p_guard_family_id
    and status = 'active';
  if active_for_guard >= limits.active_sessions_per_user_per_guard then
    raise exception using errcode = 'P0001', message = 'ACTIVE_SESSION_LIMIT';
  end if;

  select coalesce(sum(total_tokens), 0) into global_tokens
  from public.usage_ledger where occurred_at >= utc_day_start;
  if global_tokens >= limits.daily_token_budget_global then
    raise exception using errcode = 'P0001', message = 'GLOBAL_DAILY_TOKEN_BUDGET';
  end if;

  select coalesce(sum(total_tokens), 0) into user_tokens
  from public.usage_ledger
  where user_id = p_attacker_id and occurred_at >= utc_day_start;
  if user_tokens >= limits.daily_token_budget_per_user then
    raise exception using errcode = 'P0001', message = 'USER_DAILY_TOKEN_BUDGET';
  end if;

  insert into public.sessions (id, guard_id, guard_family_id, attacker_id)
  values (p_session_id, p_guard_id, p_guard_family_id, p_attacker_id);
  insert into public.session_secrets (session_id, secret)
  values (p_session_id, p_secret);
  return p_session_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ACTIVE_SESSION_LIMIT';
end;
$$;

create or replace function public.acquire_session_processing_lock(
  p_session_id uuid,
  p_attacker_id uuid,
  p_processing_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  acquired boolean;
begin
  update public.sessions
  set processing_token = p_processing_token,
      processing_started_at = now()
  where id = p_session_id
    and attacker_id = p_attacker_id
    and status = 'active'
    and (
      processing_token is null
      or processing_started_at < now() - interval '2 minutes'
    );
  acquired := found;
  return acquired;
end;
$$;

create or replace function public.release_session_processing_lock(
  p_session_id uuid,
  p_processing_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  released boolean;
begin
  update public.sessions
  set processing_token = null,
      processing_started_at = null
  where id = p_session_id and processing_token = p_processing_token;
  released := found;
  return released;
end;
$$;

create or replace function public.consume_user_message_rate_slot(p_user_id uuid)
returns table (allowed boolean, requests_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_limit integer;
  current_count integer;
begin
  select message_rate_limit_per_user_per_minute into request_limit
  from public.settings where singleton = true;
  if request_limit is null then
    raise exception using errcode = 'P0001', message = 'SETTINGS_NOT_CONFIGURED';
  end if;

  insert into public.user_message_rate_windows as existing (
    user_id, window_started_at, request_count
  ) values (p_user_id, now(), 1)
  on conflict (user_id) do update set
    window_started_at = case
      when now() >= existing.window_started_at + interval '1 minute' then now()
      else existing.window_started_at
    end,
    request_count = case
      when now() >= existing.window_started_at + interval '1 minute' then 1
      else existing.request_count + 1
    end,
    updated_at = now()
  returning request_count into current_count;

  return query select current_count <= request_limit, greatest(request_limit - current_count, 0);
end;
$$;

revoke all on function public.reserve_attack_session(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.acquire_session_processing_lock(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_session_processing_lock(uuid, uuid) from public, anon, authenticated;
revoke all on function public.consume_user_message_rate_slot(uuid) from public, anon, authenticated;
grant execute on function public.reserve_attack_session(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.acquire_session_processing_lock(uuid, uuid, uuid) to service_role;
grant execute on function public.release_session_processing_lock(uuid, uuid) to service_role;
grant execute on function public.consume_user_message_rate_slot(uuid) to service_role;
