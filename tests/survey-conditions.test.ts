import test from "node:test";
import assert from "node:assert/strict";
import { questionIsVisible } from "../lib/survey-conditions";

test("survey branch conditions handle unanswered, selected, and malformed rules", () => {
  const keys = { task: "question-1", mode: "question-2" };
  const answers = { "question-1": "yes", "question-2": ["online", "in-person"] };
  assert.equal(questionIsVisible(null, answers, keys), true);
  assert.equal(questionIsVisible({ questionKey: "task", operator: "equals", value: "yes" }, answers, keys), true);
  assert.equal(questionIsVisible({ questionKey: "task", operator: "equals", value: "no" }, answers, keys), false);
  assert.equal(questionIsVisible({ questionKey: "mode", operator: "includes", value: "online" }, answers, keys), true);
  assert.equal(questionIsVisible({ questionKey: "missing", operator: "equals" }, {}, keys), false);
  assert.equal(questionIsVisible({ questionKey: "task", operator: "unknown", value: "yes" }, answers, keys), false);
});


