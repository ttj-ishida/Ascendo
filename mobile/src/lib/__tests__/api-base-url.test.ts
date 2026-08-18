import { resolveApiBaseUrl } from '../api-base-url';

test('rewrites localhost to 10.0.2.2 on Android', () => {
  expect(resolveApiBaseUrl('http://localhost:3000', 'android')).toBe('http://10.0.2.2:3000');
});

test('rewrites 127.0.0.1 to 10.0.2.2 on Android', () => {
  expect(resolveApiBaseUrl('http://127.0.0.1:3000', 'android')).toBe('http://10.0.2.2:3000');
});

test('leaves localhost untouched on Web', () => {
  expect(resolveApiBaseUrl('http://localhost:3000', 'web')).toBe('http://localhost:3000');
});

test('leaves localhost untouched on iOS', () => {
  expect(resolveApiBaseUrl('http://localhost:3000', 'ios')).toBe('http://localhost:3000');
});

test('leaves a non-localhost URL untouched on Android (e.g. a LAN IP or physical device override)', () => {
  expect(resolveApiBaseUrl('http://192.168.1.10:3000', 'android')).toBe('http://192.168.1.10:3000');
});

test('does not mistakenly rewrite a hostname that merely starts with "localhost"', () => {
  expect(resolveApiBaseUrl('http://localhost.example.com:3000', 'android')).toBe('http://localhost.example.com:3000');
});

test('rewrites localhost with no port', () => {
  expect(resolveApiBaseUrl('http://localhost', 'android')).toBe('http://10.0.2.2');
});
