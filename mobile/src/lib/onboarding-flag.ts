import type { SecureStoreLike } from './secure-store-adapter';

const KEY = 'ascendo-has-seen-onboarding';

export async function hasSeenOnboarding(store: SecureStoreLike): Promise<boolean> {
  return (await store.getItemAsync(KEY)) === 'true';
}

export async function markOnboardingSeen(store: SecureStoreLike): Promise<void> {
  await store.setItemAsync(KEY, 'true');
}
