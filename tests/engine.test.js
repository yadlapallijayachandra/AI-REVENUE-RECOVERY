import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyFailure,
  expectedRecoveryValue,
  evaluateRecoveryStrategies,
  recommendStrategy,
  recoveryHealth,
} from "../src/lib/aiEngine.js";

test("classifies permanent failures as non-retry candidates", () => {
  const classification = classifyFailure("Expired Card");
  assert.equal(classification.category, "customer_action");
  assert.equal(recommendStrategy({ amount: 1000, failure_reason: "Invalid Payment Details", attempts: 1 }, 10).strategy, "do_not_retry");
});

test("expected recovery value accounts for probability and cost", () => {
  assert.equal(expectedRecoveryValue(10000, 50, 100), 4900);
  assert.equal(expectedRecoveryValue(1000, 2, 100), 0);
});

test("strategy evaluation is deterministic and ranked by expected value", () => {
  const transaction = { amount: 12000, payment_method: "Credit Card", failure_reason: "Network Timeout", attempts: 1 };
  const first = evaluateRecoveryStrategies(transaction, null, { retry_cost: 10 });
  const second = evaluateRecoveryStrategies(transaction, null, { retry_cost: 10 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 8);
  assert.ok(first[0].expectedValue >= first.at(-1).expectedValue);
});

test("recovery health is derived from transaction outcomes", () => {
  const health = recoveryHealth([
    { payment_method: "UPI", status: "SUCCESS" },
    { payment_method: "UPI", status: "RECOVERED", failure_reason: "Network Timeout" },
    { payment_method: "Card", status: "FAILED", failure_reason: "Bank Declined" },
  ]);
  assert.ok(health.score >= 0 && health.score <= 100);
  assert.ok(health.components.recoverySuccess > 0);
});
