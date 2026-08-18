import { draftKeyFor, serializeChatState, deserializeChatState } from '../persistence';
import type { ChatState } from '../chat-reducer';

test('draftKeyFor namespaces the storage key by userId', () => {
  expect(draftKeyFor('user-1')).toBe('ascendo-plan-creation-draft-user-1');
  expect(draftKeyFor('user-2')).toBe('ascendo-plan-creation-draft-user-2');
});

test('serializeChatState then deserializeChatState round-trips', () => {
  const state: ChatState = { messages: [{ role: 'user', content: 'Hi' }], readyToGenerate: false };
  expect(deserializeChatState(serializeChatState(state))).toEqual(state);
});

test('deserializeChatState returns null for a missing value', () => {
  expect(deserializeChatState(null)).toBeNull();
});

test('deserializeChatState returns null for corrupted JSON', () => {
  expect(deserializeChatState('not json')).toBeNull();
});

test('deserializeChatState returns null for a value missing the messages array', () => {
  expect(deserializeChatState(JSON.stringify({ readyToGenerate: true }))).toBeNull();
});

test('deserializeChatState defaults readyToGenerate to false when absent', () => {
  const raw = JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] });
  expect(deserializeChatState(raw)).toEqual({ messages: [{ role: 'user', content: 'Hi' }], readyToGenerate: false });
});
