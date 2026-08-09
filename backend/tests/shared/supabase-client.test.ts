import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUserClient, createServiceClient } from '../../src/shared/supabase-client.ts';

test('createUserClient forwards the caller access token as a Bearer header', () => {
  const client = createUserClient('https://ascendo.supabase.co', 'anon-key', 'user-access-token');
  // @supabase/supabase-js@2.112.2 exposes the configured global headers on client.headers
  // (verified by inspecting Object.keys(client) — the plan's original guess at `.rest.headers`
  // didn't match this version); this is the cheapest way to prove the token was actually wired
  // in without a network call.
  const headers = (client as unknown as { headers: Record<string, string> }).headers;
  assert.equal(headers.Authorization, 'Bearer user-access-token');
});

test('createServiceClient is a distinct client instance from createUserClient', () => {
  const service = createServiceClient('https://ascendo.supabase.co', 'service-role-key');
  const user = createUserClient('https://ascendo.supabase.co', 'anon-key', 'user-access-token');
  assert.notEqual(service, user);
  assert.equal(typeof service.from, 'function');
  assert.equal(typeof user.from, 'function');
});
