export type SurveyAnswer = string | string[] | number;
export function questionIsVisible(condition: unknown, answers: Record<string, SurveyAnswer>, byKey: Record<string, string>): boolean {
  if (!condition) return true;
  if (typeof condition !== "object" || Array.isArray(condition)) return false;
  const rule = condition as { questionKey?: string; operator?: string; value?: unknown };
  if (!rule.questionKey || !byKey[rule.questionKey] || rule.value === undefined) return false;
  const answer = answers[byKey[rule.questionKey]];
  if (rule.operator === "equals") return answer === rule.value;
  if (rule.operator === "includes" && Array.isArray(answer) && typeof rule.value === "string") return answer.includes(rule.value);
  return false;
}

