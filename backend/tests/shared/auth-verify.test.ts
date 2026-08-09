import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { verifyAccessToken } from '../../src/shared/auth/verify.ts';

async function buildLocalJwks() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'RS256';
  const jwks = createLocalJWKSet({ keys: [publicJwk] });
  return { jwks, privateKey };
}

test('verifyAccessToken accepts a validly-signed token and returns sub/role', async () => {
  const { jwks, privateKey } = await buildLocalJwks();
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setIssuer('https://ascendo.supabase.co/auth/v1')
    .setExpirationTime('1h')
    .sign(privateKey);

  const payload = await verifyAccessToken(token, jwks, 'https://ascendo.supabase.co/auth/v1');

  assert.equal(payload.sub, '11111111-1111-1111-1111-111111111111');
  assert.equal(payload.role, 'authenticated');
});

test('verifyAccessToken rejects a token signed with the wrong issuer', async () => {
  const { jwks, privateKey } = await buildLocalJwks();
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setIssuer('https://someone-else.supabase.co/auth/v1')
    .setExpirationTime('1h')
    .sign(privateKey);

  await assert.rejects(() => verifyAccessToken(token, jwks, 'https://ascendo.supabase.co/auth/v1'));
});

test('verifyAccessToken rejects an expired token', async () => {
  const { jwks, privateKey } = await buildLocalJwks();
  const token = await new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setIssuer('https://ascendo.supabase.co/auth/v1')
    .setExpirationTime('-1h')
    .sign(privateKey);

  await assert.rejects(() => verifyAccessToken(token, jwks, 'https://ascendo.supabase.co/auth/v1'));
});
