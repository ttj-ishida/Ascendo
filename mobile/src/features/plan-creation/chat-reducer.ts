import type { ChatMessage } from '../../types/plan';

export interface ChatState {
  messages: ChatMessage[];
  readyToGenerate: boolean;
}

export type ChatEvent =
  | { type: 'USER_MESSAGE'; content: string }
  | { type: 'AI_REPLY'; content: string; readyToGenerate: boolean }
  | { type: 'RESTORE'; state: ChatState };

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case 'USER_MESSAGE':
      return { ...state, messages: [...state.messages, { role: 'user', content: event.content }] };
    case 'AI_REPLY':
      return {
        messages: [...state.messages, { role: 'assistant', content: event.content }],
        readyToGenerate: event.readyToGenerate,
      };
    case 'RESTORE':
      return event.state;
  }
}
