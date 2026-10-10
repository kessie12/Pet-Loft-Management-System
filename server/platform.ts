export interface D1Result { success: boolean; meta: { changes?: number }; results?: unknown[] }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1Result>;
}
export interface Database { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<D1Result[]> }
export interface ReceiptBucket {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
}
export interface Env {
  DB: Database;
  RECEIPTS_BUCKET?: ReceiptBucket;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  INITIAL_BOSS_USERNAME?: string;
  INITIAL_BOSS_PASSWORD?: string;
  AUTH_PEPPER?: string;
  GOOGLE_SHEET_ID?: string;
}
export interface FunctionContext { request: Request; env: Env; params: Record<string, string | string[]> }
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function requireValue(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});
export const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2, '0')).join('');
