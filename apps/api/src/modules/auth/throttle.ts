import { createHmac, randomBytes } from 'node:crypto';
import { ApiError } from '../../http.js';

// Single-process ceilings. No raw network address/email is retained in buckets.
// Restart resets buckets; a shared deployment limiter is required before hosting.
export function createAuthThrottle(now: () => number = Date.now) {
  const secret = randomBytes(32);
  const buckets = new Map<string, { count: number; expires: number }>();
  const window = 15 * 60 * 1000;
  function consume(scope: string, value: string, limit: number) {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
    const key = createHmac('sha256', secret).update(scope).update('\0').update(value).digest('hex');
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 10000) throw new ApiError('RATE_LIMITED');
      bucket = { count: 0, expires: time + window };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) throw new ApiError('RATE_LIMITED');
    bucket.count++;
  }
  return {
    network(address: string) {
      consume('global', '', 120);
      consume('network', address, 30);
    },
    account(email: string) { consume('account', email, 5); },
  };
}
