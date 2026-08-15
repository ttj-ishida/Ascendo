import { hasSeenOnboarding, markOnboardingSeen } from '../onboarding-flag';
import type { SecureStoreLike } from '../secure-store-adapter';

function fakeStore(): SecureStoreLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItemAsync: async (key) => data[key] ?? null,
    setItemAsync: async (key, value) => { data[key] = value; },
    deleteItemAsync: async (key) => { delete data[key]; },
  };
}

test('hasSeenOnboarding is false before markOnboardingSeen is called', async () => {
  await expect(hasSeenOnboarding(fakeStore())).resolves.toBe(false);
});

test('hasSeenOnboarding is true after markOnboardingSeen', async () => {
  const store = fakeStore();
  await markOnboardingSeen(store);
  await expect(hasSeenOnboarding(store)).resolves.toBe(true);
});
