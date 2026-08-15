import { createSecureStoreAdapter, type SecureStoreLike } from '../secure-store-adapter';

function fakeStore(): SecureStoreLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItemAsync: async (key: string) => data[key] ?? null,
    setItemAsync: async (key: string, value: string) => { data[key] = value; },
    deleteItemAsync: async (key: string) => { delete data[key]; },
  };
}

test('adapter.setItem then getItem round-trips through the store', async () => {
  const store = fakeStore();
  const adapter = createSecureStoreAdapter(store);

  await adapter.setItem('sb-session', '{"token":"abc"}');
  const value = await adapter.getItem('sb-session');

  expect(value).toBe('{"token":"abc"}');
  expect(store.data['sb-session']).toBe('{"token":"abc"}');
});

test('adapter.getItem returns null for a missing key', async () => {
  const adapter = createSecureStoreAdapter(fakeStore());
  await expect(adapter.getItem('missing')).resolves.toBeNull();
});

test('adapter.removeItem deletes the key from the store', async () => {
  const store = fakeStore();
  const adapter = createSecureStoreAdapter(store);
  await adapter.setItem('k', 'v');

  await adapter.removeItem('k');

  expect(store.data['k']).toBeUndefined();
});
