export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WeeklyTask {
  id: string;
  label: string;
  contentGroupId?: string;
}

export interface MonthlyTask {
  id: string;
  label: string;
  month: string;
  done: boolean;
}

export interface Milestone {
  id: string;
  label: string;
  targetValue: string;
  actualValue?: string;
}

export interface LearningPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weeklyTasks: WeeklyTask[];
  monthlyTasks: MonthlyTask[];
  milestones: Milestone[];
}

export interface LearningPlanJSON {
  goal: string;
  currentLevel: string;
  weeklyAvailableHours: number;
  phases: LearningPhase[];
  contentGroupIds: string[];
  conversationLog?: ChatMessage[];
}
