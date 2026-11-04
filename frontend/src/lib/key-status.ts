/** Pure helpers behind the Keys lists: status, counts, grouping and relative time. */

export type LeaseStatus = "live" | "expired" | "revoked";
export type GrantStatus = "live" | "expired" | "tripped";

export function leaseStatus(lease: { revokedAt: string | null; expiresAt: string }, now: number): LeaseStatus {
  if (lease.revokedAt !== null) return "revoked";
  return Date.parse(lease.expiresAt) <= now ? "expired" : "live";
}

export function grantStatus(grant: { trippedAt: string | null; expiresAt: string }, now: number): GrantStatus {
  if (grant.trippedAt !== null) return "tripped";
  return Date.parse(grant.expiresAt) <= now ? "expired" : "live";
}

export function countByStatus<T, S extends string>(rows: T[], statuses: readonly S[], status: (row: T) => S): Record<S, number> {
  const counts = Object.fromEntries(statuses.map((name) => [name, 0])) as Record<S, number>;
  for (const row of rows) counts[status(row)] += 1;
  return counts;
}

export interface Group<T> {
  key: string;
  rows: T[];
}

/** Groups with a live row come first, then by name; rows keep the order `order` gives them. */
export function groupRows<T>(
  rows: T[],
  key: (row: T) => string,
  isLive: (row: T) => boolean,
  order: (a: T, b: T) => number,
): Group<T>[] {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const name = key(row);
    const bucket = byKey.get(name);
    if (bucket) bucket.push(row);
    else byKey.set(name, [row]);
  }
  const groups = Array.from(byKey, ([name, bucket]) => ({ key: name, rows: bucket.slice().sort(order) }));
  return groups.sort((a, b) => {
    const liveA = a.rows.some(isLive) ? 0 : 1;
    const liveB = b.rows.some(isLive) ? 0 : 1;
    return liveA - liveB || a.key.localeCompare(b.key, undefined, { sensitivity: "base" });
  });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "in 2 days", "3 hours ago", "just now". */
export function relativeTime(iso: string, now: number): string {
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  if (!Number.isFinite(diff) || abs < MINUTE) return "just now";
  const [amount, unit] = abs >= DAY ? [Math.floor(abs / DAY), "day"] : abs >= HOUR ? [Math.floor(abs / HOUR), "hour"] : [Math.floor(abs / MINUTE), "minute"];
  const text = `${amount} ${unit}${amount === 1 ? "" : "s"}`;
  return diff > 0 ? `in ${text}` : `${text} ago`;
}
