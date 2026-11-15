-- Stage 5: persistent game data and row-level security.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  callsign text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_callsign_format check (callsign ~ '^[A-Za-z0-9_]{3,16}$')
);

create unique index if not exists profiles_callsign_unique_idx
  on public.profiles (lower(callsign));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_callsign text := new.raw_user_meta_data ->> 'callsign';
begin
  if requested_callsign is null or requested_callsign = '' then
    requested_callsign := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  if requested_callsign !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'Callsign must be 3 to 16 letters, digits or underscores.';
  end if;

  insert into public.profiles (id, callsign)
  values (new.id, requested_callsign);
  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

-- Backfill profiles for auth users that existed before this migration.
insert into public.profiles (id, callsign)
select
  u.id,
  case
    when coalesce(u.raw_user_meta_data ->> 'callsign', '') ~ '^[A-Za-z0-9_]{3,16}$'
      then u.raw_user_meta_data ->> 'callsign'
    else 'player_' || substr(replace(u.id::text, '-', ''), 1, 8)
  end
from auth.users as u
on conflict (id) do nothing;

create table if not exists public.guards (
  id uuid primary key,
  family_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  name text not null check (char_length(name) between 2 and 24),
  instructions text not null check (char_length(instructions) between 20 and 5000),
  fields jsonb not null,
  refusal_style text not null default 'polite'
    check (refusal_style in ('polite', 'stern', 'playful', 'cryptic')),
  talkativeness text not null default 'normal'
    check (talkativeness in ('terse', 'normal', 'chatty')),
  key_type text not null check (key_type in ('code', 'word', 'number')),
  lock_type text not null check (lock_type in ('combo', 'passphrase', 'pin')),
  reveal_key_format boolean not null default false,
  look_seed text not null check (char_length(look_seed) between 1 and 100),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint guards_family_version_unique unique (family_id, version),
  constraint guards_id_family_unique unique (id, family_id),
  constraint guards_fields_shape check (
    jsonb_typeof(fields) = 'object'
    and jsonb_typeof(fields -> 'stonewall') = 'boolean'
    and jsonb_typeof(fields -> 'pokerFace') = 'boolean'
    and jsonb_typeof(fields -> 'shortAnswers') = 'boolean'
    and jsonb_typeof(fields -> 'languageLock') = 'boolean'
  ),
  constraint guards_key_lock_match check (
    (key_type = 'code' and lock_type = 'combo')
    or (key_type = 'word' and lock_type = 'passphrase')
    or (key_type = 'number' and lock_type = 'pin')
  )
);

create index if not exists guards_owner_family_idx
  on public.guards (owner_id, family_id, version desc);
create index if not exists guards_published_created_idx
  on public.guards (created_at desc) where published;

create or replace function public.enforce_guard_version_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  prior_owner uuid;
  prior_seed text;
  prior_version integer;
begin
  if tg_op = 'INSERT' then
    select owner_id, look_seed, version
      into prior_owner, prior_seed, prior_version
      from public.guards
      where family_id = new.family_id
      order by version desc
      limit 1;

    if not found then
      if new.version <> 1 or new.id <> new.family_id then
        raise exception 'A guard family must start at version 1 with matching id and family_id.';
      end if;
    else
      if new.owner_id <> prior_owner then
        raise exception 'A guard family cannot change owners.';
      end if;
      if new.look_seed <> prior_seed then
        raise exception 'A guard family must keep its original look seed.';
      end if;
      if new.version <> prior_version + 1 then
        raise exception 'Guard versions must be added in order.';
      end if;
    end if;
    return new;
  end if;

  if (to_jsonb(new) - 'published') is distinct from (to_jsonb(old) - 'published') then
    raise exception 'Guard versions are immutable; only published may change.';
  end if;
  return new;
end;
$$;

create trigger guards_version_rules
before insert or update on public.guards
for each row execute function public.enforce_guard_version_rules();

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  guard_id uuid not null,
  guard_family_id uuid not null,
  attacker_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'ended', 'errored', 'abandoned')),
  end_reason text check (end_reason in ('cracked', 'held', 'expired', 'errored', 'abandoned')),
  picks_used integer not null default 0 check (picks_used >= 0),
  wrong_guesses integer not null default 0 check (wrong_guesses >= 0),
  winning_guess text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint sessions_guard_version_fk foreign key (guard_id, guard_family_id)
    references public.guards(id, family_id) on delete cascade,
  constraint sessions_status_outcome_consistency check (
    (status = 'active' and end_reason is null and ended_at is null)
    or (status = 'ended' and end_reason is not null and end_reason in ('cracked', 'held', 'expired') and ended_at is not null)
    or (status = 'errored' and end_reason is not null and end_reason = 'errored' and ended_at is not null)
    or (status = 'abandoned' and end_reason is not null and end_reason = 'abandoned' and ended_at is not null)
  ),
  constraint sessions_winning_guess_only_on_crack check (
    (end_reason <> 'cracked' or winning_guess is not null)
    and (winning_guess is null or end_reason = 'cracked')
  )
);

create unique index if not exists sessions_one_active_per_user_family_idx
  on public.sessions (attacker_id, guard_family_id) where status = 'active';
create index if not exists sessions_attacker_recent_idx
  on public.sessions (attacker_id, created_at desc);
create index if not exists sessions_guard_recent_idx
  on public.sessions (guard_id, created_at desc);

create table if not exists public.turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  turn_index integer not null check (turn_index > 0),
  role text not null check (role in ('attacker', 'defender')),
  content text not null,
  created_at timestamptz not null default now(),
  constraint turns_session_turn_role_unique unique (session_id, turn_index, role)
);

create index if not exists turns_session_order_idx
  on public.turns (session_id, turn_index, role);

create table if not exists public.leak_flags (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  turn_index integer not null check (turn_index > 0),
  method text not null check (method in ('direct', 'normalized', 'reversed', 'spaced', 'per-line', 'spelled-out', 'whole-word')),
  matched_text text not null,
  char_index integer not null check (char_index >= 0),
  created_at timestamptz not null default now(),
  constraint leak_flags_session_turn_unique unique (session_id, turn_index, method, char_index)
);

create table if not exists public.session_secrets (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  secret text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  guard_id uuid not null references public.guards(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('offensive_orders', 'warden_is_broken', 'something_else')),
  note text check (note is null or char_length(note) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_ledger (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  role text not null check (role in ('defender', 'attacker', 'analyst')),
  provider text not null,
  model text not null,
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  success boolean not null,
  occurred_at timestamptz not null default now()
);

create index if not exists usage_ledger_user_day_idx
  on public.usage_ledger (user_id, occurred_at desc);
create index if not exists usage_ledger_day_idx
  on public.usage_ledger (occurred_at desc);

-- The row is provisioned with deployment-specific budgets before Stage 6 APIs
-- are enabled; no undocumented numeric limits are seeded here.
create table if not exists public.settings (
  singleton boolean primary key default true check (singleton),
  max_messages_per_session integer check (max_messages_per_session > 0),
  max_message_length integer check (max_message_length > 0),
  session_time_limit_seconds integer check (session_time_limit_seconds > 0),
  cooldown_seconds integer check (cooldown_seconds >= 0),
  max_wrong_attempts integer check (max_wrong_attempts > 0),
  sessions_per_user_per_guard_per_day integer check (sessions_per_user_per_guard_per_day > 0),
  sessions_per_user_per_day integer check (sessions_per_user_per_day > 0),
  daily_token_budget_total bigint check (daily_token_budget_total > 0),
  daily_token_budget_per_user bigint check (daily_token_budget_per_user > 0),
  human_attacks_enabled boolean not null default true,
  disabled_guard_ids uuid[] not null default '{}'::uuid[],
  updated_at timestamptz not null default now()
);

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
  round(e.average_survival_picks::numeric, 2) as average_survival_picks
from public.guards as g
left join ended_stats as e on e.guard_id = g.id
where g.published or g.owner_id = auth.uid();

alter table public.profiles enable row level security;
alter table public.guards enable row level security;
alter table public.sessions enable row level security;
alter table public.turns enable row level security;
alter table public.leak_flags enable row level security;
alter table public.session_secrets enable row level security;
alter table public.reports enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.settings enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy guards_select_own on public.guards
  for select to authenticated using (owner_id = auth.uid());
create policy guards_insert_own on public.guards
  for insert to authenticated with check (owner_id = auth.uid());
create policy guards_update_own on public.guards
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy sessions_select_attacker_or_owner on public.sessions
  for select to authenticated using (
    attacker_id = auth.uid()
    or exists (
      select 1 from public.guards as g
      where g.id = sessions.guard_id and g.owner_id = auth.uid()
    )
  );

create policy turns_select_attacker_or_owner on public.turns
  for select to authenticated using (
    exists (
      select 1
      from public.sessions as s
      where s.id = turns.session_id
        and s.attacker_id = auth.uid()
    )
    or exists (
      select 1
      from public.sessions as s
      join public.guards as g on g.id = s.guard_id
      where s.id = turns.session_id
        and g.owner_id = auth.uid()
    )
  );

create policy leak_flags_select_guard_owner_after_end on public.leak_flags
  for select to authenticated using (
    exists (
      select 1
      from public.sessions as s
      join public.guards as g on g.id = s.guard_id
      where s.id = leak_flags.session_id
        and g.owner_id = auth.uid()
        and s.status <> 'active'
    )
  );

create policy reports_select_reporter_or_guard_owner on public.reports
  for select to authenticated using (
    reporter_id = auth.uid()
    or exists (
      select 1 from public.guards as g
      where g.id = reports.guard_id and g.owner_id = auth.uid()
    )
  );
create policy reports_insert_own on public.reports
  for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');

revoke all on public.profiles, public.guards, public.sessions, public.turns,
  public.leak_flags, public.session_secrets, public.reports, public.usage_ledger,
  public.settings from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (callsign) on public.profiles to authenticated;
grant select, insert on public.guards to authenticated;
grant update (published) on public.guards to authenticated;
grant select on public.sessions, public.turns, public.leak_flags to authenticated;
grant select, insert on public.reports to authenticated;
grant select on public.guard_version_stats to anon, authenticated;

revoke all on public.session_secrets, public.usage_ledger, public.settings
  from public, anon, authenticated;
grant all on public.session_secrets, public.usage_ledger, public.settings
  to service_role;
grant all on public.profiles, public.guards, public.sessions, public.turns,
  public.leak_flags, public.reports to service_role;

comment on view public.guard_version_stats is
  'Published guard details plus private rows for their owner; exposes no instructions or owner identifiers.';
comment on table public.session_secrets is
  'No normal-user policies or grants; read and write only from trusted service-role functions.';
comment on table public.settings is
  'Deployment limits and kill switches. Populate all limit values before enabling Stage 6 APIs.';
