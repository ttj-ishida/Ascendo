import type { ChatState } from './chat-reducer';

const DRAFT_KEY_PREFIX = 'ascendo-plan-creation-draft';

/** Namespaced per user (not a single fixed key) so one account's in-progress plan-creation
 * conversation can never leak into a different account signed in later on the same device —
 * this app has a logout path (plan-creation.tsx itself, for users with no plan yet) that makes
 * switching accounts on one browser/device a real scenario, not just a theoretical one. */
export function draftKeyFor(userId: string): string {
  return `${DRAFT_KEY_PREFIX}-${userId}`;
}

export function serializeChatState(state: ChatState): string {
  return JSON.stringify(state);
}

/** Returns null (rather than throwing) for anything that isn't recognizably a ChatState — a
 * missing key, corrupted JSON, or a shape from some future/past version of this app — so a
 * broken persisted draft degrades to "start a fresh conversation" instead of crashing the screen. */
export function deserializeChatState(raw: string | null): ChatState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChatState> | null;
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return { messages: parsed.messages, readyToGenerate: parsed.readyToGenerate === true };
  } catch {
    return null;
  }
}
