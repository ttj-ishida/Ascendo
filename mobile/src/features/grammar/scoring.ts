export function isCorrectChoice(correctAnswer: string, selected: string): boolean {
  return correctAnswer.trim() === selected.trim();
}
