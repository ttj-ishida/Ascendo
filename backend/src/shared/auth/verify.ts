import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface TokenPayload {
  sub: string;
  role?: string;
}

export async function verifyAccessToken(
  token: string,
  getKey: JWTVerifyGetKey,
  issuer: string,
): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getKey, { issuer });
  if (typeof payload.sub !== 'string') {
    throw new Error('token payload missing "sub" claim');
  }
  return {
    sub: payload.sub,
    role: typeof payload.role === 'string' ? payload.role : undefined,
  };
}

export function createJwksVerifier(supabaseUrl: string): (token: string) => Promise<TokenPayload> {
  const issuer = `${supabaseUrl}/auth/v1`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return (token: string) => verifyAccessToken(token, jwks, issuer);
}
