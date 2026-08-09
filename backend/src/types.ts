export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LearningPlanJSON {
  goal: string;
  currentLevel: string;
  weeklyAvailableHours: number;
  phases: unknown[];
  contentGroupIds: string[];
  conversationLog?: ChatMessage[];
}
