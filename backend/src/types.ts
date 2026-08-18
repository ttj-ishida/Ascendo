export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WeeklyTask {
  id: string;
  label: string;
  contentGroupId?: string; // references content_groups.id, if applicable (app-side validated, not a DB FK — ADR-05)
}

export interface MonthlyTask {
  id: string;
  label: string;
  month: string; // "2026-09" format
}

export interface Milestone {
  id: string;
  label: string;
  targetValue: string;
  actualValue?: string;
}

export interface LearningPhase {
  id: string;
  name: string; // e.g. "Phase 1: 基礎固め"
  startDate: string; // ISO8601 date
  endDate: string;
  weeklyTasks: WeeklyTask[];
  monthlyTasks: MonthlyTask[];
  milestones: Milestone[];
}

/** Content the AI is allowed to reference when building a plan (ADR-05: the AI selects among
 * existing content_groups, it never invents content). Passed into AiAdapter.generatePlan as
 * grounding context. */
export interface ContentGroupOption {
  id: string;
  title: string;
  type: 'vocabulary' | 'grammar' | 'listening' | 'shadowing' | 'mixed';
}

export interface LearningPlanJSON {
  goal: string;
  currentLevel: string;
  weeklyAvailableHours: number;
  phases: LearningPhase[];
  contentGroupIds: string[]; // must be a subset of the ContentGroupOption ids offered to the AI
  conversationLog?: ChatMessage[];
}
