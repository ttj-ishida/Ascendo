import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';

test('GET /health returns 200 ok', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;

  const res = await fetch(`http://127.0.0.1:${port}/health`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body, { status: 'ok' });

  server.close();
});
