export function parseAuthDeepLink(url: string): 'signup-confirm' | 'password-recovery' | null {
  try {
    const parsed = new URL(url);
    const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const params = new URLSearchParams(fragment);
    const type = params.get('type');

    if (type === 'signup') return 'signup-confirm';
    if (type === 'recovery') return 'password-recovery';
    return null;
  } catch {
    return null;
  }
}
