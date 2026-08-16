import { createWebSecureStore, type WebStorageLike } from '../platform-secure-store';

function fakeWebStorage(): WebStorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

test('setItemAsync then getItemAsync round-trips through localStorage', async () => {
  const store = fakeWebStorage();
  const adapter = createWebSecureStore(store);

  await adapter.setItemAsync('sb-session', '{"token":"abc"}');
  const value = await adapter.getItemAsync('sb-session');

  expect(value).toBe('{"token":"abc"}');
  expect(store.data['sb-session']).toBe('{"token":"abc"}');
});

test('getItemAsync returns null for a missing key', async () => {
  const adapter = createWebSecureStore(fakeWebStorage());
  await expect(adapter.getItemAsync('missing')).resolves.toBeNull();
});

test('deleteItemAsync removes the key from localStorage', async () => {
  const store = fakeWebStorage();
  const adapter = createWebSecureStore(store);
  await adapter.setItemAsync('k', 'v');

  await adapter.deleteItemAsync('k');

  expect(store.data['k']).toBeUndefined();
});
