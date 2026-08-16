import { createWebStorageAdapter, type WebStorageLike } from '../web-storage-adapter';

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

test('adapter.setItem then getItem round-trips through localStorage', async () => {
  const store = fakeWebStorage();
  const adapter = createWebStorageAdapter(store);

  await adapter.setItem('sb-session', '{"token":"abc"}');
  const value = await adapter.getItem('sb-session');

  expect(value).toBe('{"token":"abc"}');
  expect(store.data['sb-session']).toBe('{"token":"abc"}');
});

test('adapter.getItem returns null for a missing key', async () => {
  const adapter = createWebStorageAdapter(fakeWebStorage());
  await expect(adapter.getItem('missing')).resolves.toBeNull();
});

test('adapter.removeItem deletes the key from localStorage', async () => {
  const store = fakeWebStorage();
  const adapter = createWebStorageAdapter(store);
  await adapter.setItem('k', 'v');

  await adapter.removeItem('k');

  expect(store.data['k']).toBeUndefined();
});
