// RecoverAI recovery orchestration service.
// Centralizes the end-to-end recovery flow so every UI surface (queue, drawer,
// detail page, simulator) drives the SAME state cascade, audit events, retry
// limits and idempotency. Keeps transaction ↔ recovery case ↔ customer ↔
// notification ↔ audit log consistent.

import { localClient } from "@/api/localDataClient";
import {
  predictRecoveryProbability,
  classifyFailure,
  recommendStrategy,
  recommendRetryTime,
  opportunityScore,
  evaluateRecoveryStrategies,
  expectedRecoveryValue,
  explainDecision,
} from "@/lib/aiEngine";

// Canonical audit event types (stored in AuditLog.event_type; action mirrors it).
export const AUDIT_EVENT_TYPES = [
  "RISK_DETECTED",
  "RULE_APPLIED",
  "AI_INVOKED",
  "AI_FALLBACK",
  "POLICY_APPROVED",
  "POLICY_REJECTED",
  "ACTION_EXECUTED",
  "ACTION_FAILED",
  "CASE_RESOLVED",
  "CASE_ESCALATED",
  "CASE_CLOSED",
  "SYSTEM_ERROR",
  "NOTIFICATION_SENT",
  "RECOVERY_SCHEDULED",
  "SETTINGS_CHANGED",
  "RULE_CREATED",
  "RULE_UPDATED",
  "RULE_DELETED",
  "LOGIN",
  "LOGOUT",
];

export const EVENT_TYPE_LABELS = {
  RISK_DETECTED: "Risk Detected",
  RULE_APPLIED: "Rule Applied",
  AI_INVOKED: "AI Invoked",
  AI_FALLBACK: "AI Fallback",
  POLICY_APPROVED: "Policy Approved",
  POLICY_REJECTED: "Policy Rejected",
  ACTION_EXECUTED: "Action Executed",
  ACTION_FAILED: "Action Failed",
  CASE_RESOLVED: "Case Resolved",
  CASE_ESCALATED: "Case Escalated",
  CASE_CLOSED: "Case Closed",
  SYSTEM_ERROR: "System Error",
  NOTIFICATION_SENT: "Notification Sent",
  RECOVERY_SCHEDULED: "Recovery Scheduled",
  SETTINGS_CHANGED: "Settings Changed",
  RULE_CREATED: "Rule Created",
  RULE_UPDATED: "Rule Updated",
  RULE_DELETED: "Rule Deleted",
  LOGIN: "Login",
  LOGOUT: "Logout",
};

export const EVENT_TYPE_BADGE = {
  RISK_DETECTED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  RULE_APPLIED: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  AI_INVOKED: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  AI_FALLBACK: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  POLICY_APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  POLICY_REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  ACTION_EXECUTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  ACTION_FAILED: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  CASE_RESOLVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  CASE_ESCALATED: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  CASE_CLOSED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  SYSTEM_ERROR: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  NOTIFICATION_SENT: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  RECOVERY_SCHEDULED: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  SETTINGS_CHANGED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  RULE_CREATED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  RULE_UPDATED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  RULE_DELETED: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  LOGIN: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  LOGOUT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export const DEFAULT_SETTINGS = {
  business_name: "RecoverAI Demo Merchant",
  business_email: "merchant@recoverai.local",
  industry: "Fintech",
  max_retries: 3,
  retry_interval: 30,
  min_recovery_probability: 40,
  auto_retry: true,
  escalation_threshold: 50000,
  email_notifications: true,
  sms_notifications: false,
  inapp_notifications: true,
  ai_model: "transparent_scoring",
  ai_confidence_threshold: 60,
  explainability: true,
  two_factor: true,
  session_timeout: 30,
  ip_whitelist: "",
  allowed_payment_methods: ["UPI", "Credit Card"],
  recovery_strategy: "adaptive",
  onboarding_complete: false,
  notification_cost: 5,
  retry_cost: 10,
  operational_cost: 50,
};

const SETTINGS_FIELDS = [
  "business_name", "business_email", "industry",
  "max_retries", "retry_interval", "min_recovery_probability", "auto_retry", "escalation_threshold",
  "email_notifications", "sms_notifications", "inapp_notifications",
  "ai_model", "ai_confidence_threshold", "explainability",
  "two_factor", "session_timeout", "ip_whitelist",
  "allowed_payment_methods", "recovery_strategy", "onboarding_complete",
  "notification_cost", "retry_cost", "operational_cost",
];

let _settingsCache = null;

export async function getSettings() {
  if (_settingsCache) return _settingsCache;
  try {
    const list = await localClient.entities.Settings.list("-created_date", 1);
    _settingsCache = list && list[0] ? { ...DEFAULT_SETTINGS, ...list[0] } : { ...DEFAULT_SETTINGS };
  } catch {
    _settingsCache = { ...DEFAULT_SETTINGS };
  }
  return _settingsCache;
}

export async function saveSettings(partial) {
  const clean = {};
  SETTINGS_FIELDS.forEach((f) => { if (partial[f] !== undefined) clean[f] = partial[f]; });
  let saved;
  try {
    const list = await localClient.entities.Settings.list("-created_date", 1);
    if (list && list[0]) saved = await localClient.entities.Settings.update(list[0].id, clean);
    else saved = await localClient.entities.Settings.create({ ...DEFAULT_SETTINGS, ...clean });
  } catch {
    // If Settings entity unavailable, operate on in-memory defaults.
    saved = { ...DEFAULT_SETTINGS, ...clean };
  }
  _settingsCache = { ...DEFAULT_SETTINGS, ...saved };
  await logAuditEvent("SETTINGS_CHANGED", {
    entity: "Settings",
    details: "Updated merchant recovery policy",
    prev: "", next: JSON.stringify({ max_retries: clean.max_retries, auto_retry: clean.auto_retry, escalation_threshold: clean.escalation_threshold }),
  });
  return _settingsCache;
}

// Canonical audit event creator.
export async function logAuditEvent(event_type, { entity = "", entity_id = "", recovery_case_id = "", severity = "info", details = "", prev = "", next = "" } = {}) {
  try {
    let user = "system";
    try { const me = await localClient.auth.me(); if (me) user = me.email || me.full_name || "user"; } catch {}
    await localClient.entities.AuditLog.create({
      action: event_type,
      event_type,
      entity,
      entity_id,
      recovery_case_id,
      user,
      severity,
      previous_value: prev,
      new_value: next,
      details,
    });
  } catch {}
}

// ---- Recovery case creation (end-to-end flow entry point) ----

export async function createRecoveryCaseFromTransaction(tx, settings) {
  const s = settings || (await getSettings());
  let customer = null;
  if (tx.customer_id) {
    try { const c = await localClient.entities.Customer.filter({ customer_id: tx.customer_id }, null, 1); customer = c[0] || null; } catch {}
  }
  const analysis = predictRecoveryProbability(tx, customer);
  const cls = classifyFailure(tx.failure_reason);
  const strategies = evaluateRecoveryStrategies(tx, customer, s);
  const selected = strategies[0];
  const strat = recommendStrategy(tx, selected?.probability ?? analysis.probability);
  const rt = recommendRetryTime(tx);
  const highValue = tx.amount >= (s.escalation_threshold ?? 50000);
  const riskLevel = strat.priority === "CRITICAL" ? "Critical" : strat.priority === "HIGH" ? "High" : strat.priority === "MEDIUM" ? "Medium" : "Low";
  const policyStatus = highValue ? "PENDING" : "NOT_REQUIRED";

  const caseRow = await localClient.entities.RecoveryCase.create({
    transaction_id: tx.transaction_id,
    order_id: tx.order_id,
    customer_name: tx.customer_name,
    customer_email: tx.customer_email,
    amount: tx.amount,
    payment_method: tx.payment_method,
    failure_reason: tx.failure_reason,
    failure_category: cls.category,
    recovery_probability: analysis.probability,
    expected_recovery_value: expectedRecoveryValue(tx.amount, selected?.probability ?? analysis.probability, s.retry_cost),
    priority: strat.priority,
    recommended_action: strat.action,
    recommended_retry_time: rt.window,
    recommended_channel: cls.recommendedChannel,
    confidence: analysis.confidence,
    strategy: strat.strategy,
    status: "PENDING",
    attempts: tx.attempts || 1,
    opportunity_score: opportunityScore(tx.amount, analysis.probability),
    source: "ai_engine",
    policy_status: policyStatus,
    risk_level: riskLevel,
    ai_recommendation: strat.action,
    strategy_options: strategies,
    decision_explanation: explainDecision(tx, analysis, selected, s),
  });

  await logAuditEvent("RISK_DETECTED", { entity: "Transaction", entity_id: tx.transaction_id, recovery_case_id: caseRow.id, severity: highValue ? "warning" : "info", details: `Failure detected — ${tx.failure_reason}` });
  await logAuditEvent("AI_INVOKED", { entity: "Transaction", entity_id: tx.transaction_id, recovery_case_id: caseRow.id, details: `Recovery probability ${analysis.probability}% · confidence ${analysis.confidence}%` });
  await logAuditEvent("RULE_APPLIED", { entity: "RecoveryCase", entity_id: tx.transaction_id, recovery_case_id: caseRow.id, details: `Strategy: ${strat.strategy} · priority ${strat.priority}` });

  return { caseRow, analysis, strat, rt };
}

// ---- Recovery actions ----

// Idempotency guard: terminal cases cannot be re-processed.
function isTerminal(caseRow) {
  return caseRow && ["RECOVERED", "CLOSED", "DISMISSED", "PERMANENTLY_FAILED"].includes(caseRow.status);
}

export async function executeRetry(tx, caseRow, settings, idempotencyKey) {
  const s = settings || (await getSettings());
  if (isTerminal(caseRow)) {
    return { ok: false, reason: "already_processed", message: "This recovery action has already been processed." };
  }
  // Policy gate: high-value cases require approval before retry.
  if (caseRow && caseRow.policy_status === "PENDING") {
    return { ok: false, reason: "approval_required", message: "Policy approval required before retrying this high-value case." };
  }
  const maxRetries = Number(s.max_retries ?? 3);
  const attempts = Number(caseRow?.attempts ?? tx.attempts ?? 1);
  const key = idempotencyKey || `retry:${caseRow?.id || tx.id}:${attempts}`;
  const existingAttempts = await localClient.entities.RecoveryAttempt.filter({ idempotency_key: key }, null, 1);
  if (existingAttempts[0]) return { ...existingAttempts[0].result, duplicate: true, message: "Duplicate recovery request prevented." };
  if (attempts >= maxRetries) {
    await localClient.entities.Transaction.update(tx.id, { status: "PERMANENTLY_FAILED" });
    if (caseRow) await localClient.entities.RecoveryCase.update(caseRow.id, { status: "PERMANENTLY_FAILED" });
    await logAuditEvent("ACTION_FAILED", { entity: "Transaction", entity_id: tx.transaction_id, recovery_case_id: caseRow?.id || "", severity: "warning", details: `Retry limit (${maxRetries}) reached — marked permanently failed` });
    return { ok: false, reason: "limit_reached", message: `Maximum retries (${maxRetries}) reached. Transaction marked permanently failed.` };
  }

  const prob = caseRow?.recovery_probability ?? tx.recovery_probability ?? 50;
  const fingerprint = `${key}:${tx.transaction_id}:${tx.amount}`;
  const hash = [...fingerprint].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 100, 7);
  const success = hash < prob;
  const newAttempts = attempts + 1;

  const attempt = await localClient.entities.RecoveryAttempt.create({
    transaction_id: tx.transaction_id,
    recovery_case_id: caseRow?.id || "",
    action: "RETRY",
    idempotency_key: key,
    status: "PROCESSING",
    outcome: success ? "SUCCESS" : "FAILURE",
    probability: prob,
  });

  await localClient.entities.Transaction.update(tx.id, {
    status: success ? "RECOVERED" : "RECOVERY_ATTEMPTED",
    attempts: newAttempts,
    recovered_at: success ? new Date().toISOString() : null,
    recovery_status: success ? "RECOVERED" : "ATTEMPTED",
    expected_recovery_value: success ? 0 : expectedRecoveryValue(tx.amount, prob, s.retry_cost),
  });
  if (caseRow) await localClient.entities.RecoveryCase.update(caseRow.id, { status: success ? "RECOVERED" : "ATTEMPTED", attempts: newAttempts });

  let customer = null;
  if (tx.customer_id) { try { const c = await localClient.entities.Customer.filter({ customer_id: tx.customer_id }, null, 1); customer = c[0]; } catch {} }
  if (success && customer) {
    await localClient.entities.Customer.update(customer.id, {
      successful_transactions: (customer.successful_transactions || 0) + 1,
      failed_transactions: Math.max(0, (customer.failed_transactions || 0) - 1),
      recovery_success_count: (customer.recovery_success_count || 0) + 1,
      lifetime_value: (customer.lifetime_value || 0) + tx.amount,
    });
  }

  await localClient.entities.Notification.create({
    type: success ? "recovery_success" : "payment_failure",
    title: success ? "Payment recovered" : "Retry attempted",
    message: `${tx.transaction_id} ${success ? "recovered" : "retry attempted"} — ₹${tx.amount.toLocaleString("en-IN")}`,
    channel: "In-app", recipient: tx.customer_email, status: "unread", entity_id: tx.transaction_id,
  });

  await logAuditEvent("ACTION_EXECUTED", { entity: "Transaction", entity_id: tx.transaction_id, recovery_case_id: caseRow?.id || "", details: `Retry executed — ${success ? "SUCCESS" : "FAILED"}`, prev: tx.status, next: success ? "RECOVERED" : "RECOVERY_ATTEMPTED" });
  if (success) {
    await logAuditEvent("CASE_RESOLVED", { entity: "RecoveryCase", entity_id: tx.transaction_id, recovery_case_id: caseRow?.id || "", details: `Case resolved — ₹${tx.amount.toLocaleString("en-IN")} recovered` });
  } else {
    await logAuditEvent("ACTION_FAILED", { entity: "Transaction", entity_id: tx.transaction_id, recovery_case_id: caseRow?.id || "", severity: "warning", details: `Retry failed (attempt ${newAttempts}/${maxRetries})` });
  }
  await localClient.entities.RecoveryAttempt.update(attempt.id, { status: success ? "SUCCESS" : "FAILED", completed_at: new Date().toISOString() });
  const result = { ok: true, success, attempts: newAttempts };
  await localClient.entities.RecoveryAttempt.update(attempt.id, { result });
  return result;
}

export async function scheduleRetry(caseRow, when, settings) {
  const s = settings || (await getSettings());
  if (isTerminal(caseRow)) return { ok: false, message: "This recovery action has already been processed." };
  if (!s.auto_retry) return { ok: false, message: "Automatic retry is disabled in settings." };
  const iso = when || new Date(Date.now() + (s.retry_interval || 30) * 60000).toISOString();
  await localClient.entities.RecoveryCase.update(caseRow.id, { status: "SCHEDULED", scheduled_at: iso });
  await logAuditEvent("RECOVERY_SCHEDULED", { entity: "RecoveryCase", entity_id: caseRow.transaction_id, recovery_case_id: caseRow.id, details: `Retry scheduled at ${new Date(iso).toLocaleString("en-IN")}` });
  return { ok: true };
}

export async function sendReminder(caseRow) {
  if (isTerminal(caseRow)) return { ok: false, message: "This recovery action has already been processed." };
  const channel = caseRow.recommended_channel || "In-app";
  if (channel !== "In-app") return { ok: false, message: `${channel} delivery is not configured. No reminder was sent.` };
  await localClient.entities.Notification.create({
    type: "payment_failure", title: "Payment reminder sent",
    message: `Reminder sent to ${caseRow.customer_name} for ${caseRow.transaction_id}`,
    channel, recipient: caseRow.customer_email, status: "unread", entity_id: caseRow.transaction_id,
  });
  await logAuditEvent("NOTIFICATION_SENT", { entity: "Notification", entity_id: caseRow.transaction_id, recovery_case_id: caseRow.id, details: `Reminder sent via ${channel}` });
  return { ok: true };
}

export async function useAlternativeMethod(caseRow, method) {
  if (isTerminal(caseRow)) return { ok: false, message: "This recovery action has already been processed." };
  await localClient.entities.RecoveryCase.update(caseRow.id, { strategy: "alternative_method", recommended_action: `Request alternative method: ${method}` });
  await logAuditEvent("ACTION_EXECUTED", { entity: "RecoveryCase", entity_id: caseRow.transaction_id, recovery_case_id: caseRow.id, details: `Alternative payment method selected: ${method}` });
  return { ok: true };
}

export async function escalateCase(caseRow) {
  if (isTerminal(caseRow)) return { ok: false, message: "This recovery action has already been processed." };
  await localClient.entities.RecoveryCase.update(caseRow.id, { status: "ESCALATED" });
  await logAuditEvent("CASE_ESCALATED", { entity: "RecoveryCase", entity_id: caseRow.transaction_id, recovery_case_id: caseRow.id, severity: "warning", details: "Case escalated to manual review" });
  return { ok: true };
}

export async function closeCase(caseRow, reason = "") {
  await localClient.entities.RecoveryCase.update(caseRow.id, { status: "CLOSED", closure_reason: reason });
  await logAuditEvent("CASE_CLOSED", { entity: "RecoveryCase", entity_id: caseRow.transaction_id, recovery_case_id: caseRow.id, details: reason ? `Case closed: ${reason}` : "Case closed" });
  return { ok: true };
}

export async function approvePolicy(caseRow) {
  await localClient.entities.RecoveryCase.update(caseRow.id, { policy_status: "APPROVED", human_decision: "approved" });
  await logAuditEvent("POLICY_APPROVED", { entity: "RecoveryCase", entity_id: caseRow.transaction_id, recovery_case_id: caseRow.id, details: `Policy approved for ${caseRow.transaction_id} (₹${caseRow.amount.toLocaleString("en-IN")})` });
  return { ok: true };
}

export async function rejectPolicy(caseRow, reason = "") {
  await localClient.entities.RecoveryCase.update(caseRow.id, { policy_status: "REJECTED", human_decision: "rejected", override_reason: reason, status: "DISMISSED" });
  await logAuditEvent("POLICY_REJECTED", { entity: "RecoveryCase", entity_id: caseRow.transaction_id, recovery_case_id: caseRow.id, severity: "warning", details: reason ? `Policy rejected: ${reason}` : "Policy rejected" });
  return { ok: true };
}

export async function overrideRecommendation(caseRow, decision, reason) {
  await localClient.entities.RecoveryCase.update(caseRow.id, { human_decision: decision, override_reason: reason });
  await logAuditEvent(decision === "approved" ? "POLICY_APPROVED" : "POLICY_REJECTED", {
    entity: "RecoveryCase", entity_id: caseRow.transaction_id, recovery_case_id: caseRow.id,
    severity: decision === "rejected" ? "warning" : "info",
    details: `Manual override — ${decision}${reason ? `: ${reason}` : ""}`,
  });
  return { ok: true };
}

// ---- Derived metrics for dashboard cards ----

export function computeRecoveryMetrics(cases) {
  const active = cases.filter((c) => ["PENDING", "SCHEDULED", "ATTEMPTED", "ESCALATED"].includes(c.status));
  const recovered = cases.filter((c) => c.status === "RECOVERED");
  const approved = cases.filter((c) => c.policy_status === "APPROVED");
  const atRisk = active.reduce((s, c) => s + (c.amount || 0), 0);
  const recoveredAmount = recovered.reduce((s, c) => s + (c.amount || 0), 0);
  return {
    visible: cases.length,
    activeCount: active.length,
    atRisk,
    recoveredAmount,
    recoveredCount: recovered.length,
    policyApproved: approved.length,
    policyPending: cases.filter((c) => c.policy_status === "PENDING").length,
  };
}