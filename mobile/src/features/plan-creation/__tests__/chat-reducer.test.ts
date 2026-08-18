import { chatReducer, type ChatState } from '../chat-reducer';

const EMPTY: ChatState = { messages: [], readyToGenerate: false };

test('USER_MESSAGE appends a user message', () => {
  const next = chatReducer(EMPTY, { type: 'USER_MESSAGE', content: 'Hello' });
  expect(next.messages).toEqual([{ role: 'user', content: 'Hello' }]);
});

test('AI_REPLY appends an assistant message and sets readyToGenerate', () => {
  const next = chatReducer(EMPTY, { type: 'AI_REPLY', content: 'What is your goal?', readyToGenerate: true });
  expect(next.messages).toEqual([{ role: 'assistant', content: 'What is your goal?' }]);
  expect(next.readyToGenerate).toBe(true);
});

test('messages accumulate across multiple dispatches', () => {
  let state = chatReducer(EMPTY, { type: 'USER_MESSAGE', content: 'Hi' });
  state = chatReducer(state, { type: 'AI_REPLY', content: 'Hello! What is your goal?', readyToGenerate: false });
  state = chatReducer(state, { type: 'USER_MESSAGE', content: 'TOEIC 500' });
  expect(state.messages).toHaveLength(3);
});

test('RESTORE replaces the whole state wholesale (used to resume a persisted draft)', () => {
  const persisted: ChatState = {
    messages: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello!' }],
    readyToGenerate: true,
  };
  const next = chatReducer(EMPTY, { type: 'RESTORE', state: persisted });
  expect(next).toEqual(persisted);
});
