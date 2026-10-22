import assert from 'node:assert/strict';

// Run against already-started local services and a ready replica set; no application data is inserted.
const web = new URL(`http://127.0.0.1:${process.env.PORT ?? '3000'}`);
const api = new URL(`http://127.0.0.1:${process.env.API_PORT ?? '4000'}`);
async function request(url) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `Expected HTTP 200 from ${url}`);
  return response;
}

const [page, direct, proxied, ready, proxiedReady] = await Promise.all([
  request(web), request(new URL('/health/live', api)), request(new URL('/health/live', web)),
  request(new URL('/health/ready', api)), request(new URL('/health/ready', web)),
]);
assert.match(page.headers.get('content-type') ?? '', /text\/html/);
const html = await page.text();
assert.match(html, /Visual Form Builder/);
assert.match(html, /Check API connection/);
assert.match(direct.headers.get('cache-control') ?? '', /no-store/);
assert.match(proxied.headers.get('cache-control') ?? '', /no-store/);
const expected = { status: 'ok', service: 'visual-form-builder-api' };
assert.deepEqual(await direct.json(), expected);
assert.deepEqual(await proxied.json(), expected);
for (const response of [ready, proxiedReady]) {
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.deepEqual(await response.json(), { status: 'ready', service: 'visual-form-builder-api' });
}
console.log('PASS: Next.js page, direct/proxied liveness and replica-set readiness are reachable.');
