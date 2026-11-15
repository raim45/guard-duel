export class DatabaseError extends Error {
  readonly status: number;
  readonly databaseCode: string | undefined;

  constructor(message: string, status: number, databaseCode?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.status = status;
    this.databaseCode = databaseCode;
  }
}

export interface SelectResult<T> {
  rows: T[];
  totalCount: number | null;
}

export class SupabaseRestClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly bearer: string;

  constructor(baseUrl: string, apiKey: string, bearer = apiKey) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.bearer = bearer;
  }

  async select<T>(table: string, query: Record<string, string>, options: {
    range?: [number, number];
    exactCount?: boolean;
  } = {}): Promise<SelectResult<T>> {
    const headers = this.headers();
    if (options.exactCount) headers.set('Prefer', 'count=exact');
    if (options.range) {
      headers.set('Range-Unit', 'items');
      headers.set('Range', `${options.range[0]}-${options.range[1]}`);
    }
    const url = new URL(`${this.baseUrl}/rest/v1/${table}`);
    url.search = new URLSearchParams(query).toString();
    const response = await fetch(url, { headers });
    const data = await this.readResponse(response);
    const range = response.headers.get('content-range');
    const total = range?.split('/')[1];
    return {
      rows: Array.isArray(data) ? data as T[] : [],
      totalCount: total && total !== '*' ? Number(total) : null,
    };
  }

  async insert<T>(table: string, rows: unknown): Promise<T[]> {
    const response = await fetch(`${this.baseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(rows),
    });
    const data = await this.readResponse(response);
    return Array.isArray(data) ? data as T[] : [];
  }

  async patch<T>(table: string, filters: Record<string, string>, values: unknown): Promise<T[]> {
    const url = new URL(`${this.baseUrl}/rest/v1/${table}`);
    url.search = new URLSearchParams(filters).toString();
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(values),
    });
    const data = await this.readResponse(response);
    return Array.isArray(data) ? data as T[] : [];
  }

  async delete(table: string, filters: Record<string, string>): Promise<void> {
    const url = new URL(`${this.baseUrl}/rest/v1/${table}`);
    url.search = new URLSearchParams(filters).toString();
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers({ Prefer: 'return=minimal' }),
    });
    await this.readResponse(response);
  }

  async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(args),
    });
    return await this.readResponse(response) as T;
  }

  private headers(extra: Record<string, string> = {}): Headers {
    const headers = new Headers({
      apikey: this.apiKey,
      Authorization: `Bearer ${this.bearer}`,
    });
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
    return headers;
  }

  private async readResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      const error = typeof body === 'object' && body !== null
        ? body as { message?: string; code?: string }
        : undefined;
      throw new DatabaseError(error?.message ?? 'Database request failed.', response.status, error?.code);
    }
    return body;
  }
}
