// localClient — AI Revenue Recovery Engine
// Deterministic, explainable scoring model. Structured so a real ML model
// (Logistic Regression / XGBoost / NN) could later replace the scoring function
// while keeping the same interface (RecoveryPredictionModel).

export const FAILURE_CATEGORIES = {
  "Insufficient Funds": { category: "customer_action", code: "INSUFFICIENT_FUNDS", recommendedAction: "Send customer reminder", recommendedChannel: "Email" },
  "Bank Declined": { category: "customer_action", code: "BANK_DECLINED", recommendedAction: "Notify customer & retry", recommendedChannel: "SMS" },
  "Network Timeout": { category: "temporary", code: "NETWORK_TIMEOUT", recommendedAction: "Schedule intelligent retry", recommendedChannel: "In-app" },
  "Gateway Unavailable": { category: "temporary", code: "GATEWAY_UNAVAILABLE", recommendedAction: "Schedule intelligent retry", recommendedChannel: "In-app" },
  "Authentication Failure": { category: "customer_action", code: "AUTH_FAILURE", recommendedAction: "Send customer reminder", recommendedChannel: "Email" },
  "Expired Card": { category: "customer_action", code: "EXPIRED_CARD", recommendedAction: "Request alternative payment method", recommendedChannel: "Email" },
  "Invalid Payment Details": { category: "permanent", code: "INVALID_DETAILS", recommendedAction: "Request alternative payment method", recommendedChannel: "Email" },
  "Unsupported Payment Method": { category: "permanent", code: "UNSUPPORTED_METHOD", recommendedAction: "Request alternative payment method", recommendedChannel: "Email" },
  "UPI Failure": { category: "temporary", code: "UPI_FAILURE", recommendedAction: "Schedule intelligent retry", recommendedChannel: "In-app" },
  "Wallet Failure": { category: "temporary", code: "WALLET_FAILURE", recommendedAction: "Schedule intelligent retry", recommendedChannel: "In-app" },
  "Unknown Error": { category: "unknown", code: "UNKNOWN", recommendedAction: "Send for further analysis", recommendedChannel: "In-app" },
};

export const FAILURE_REASONS = Object.keys(FAILURE_CATEGORIES);

const METHOD_BASE_SUCCESS = {
  "UPI": 0.78,
  "Credit Card": 0.82,
  "Debit Card": 0.74,
  "Net Banking": 0.71,
  "Wallet": 0.76,
};

// Classify a failure reason into a category with recommended action.
export function classifyFailure(reason) {
  const meta = FAILURE_CATEGORIES[reason] || FAILURE_CATEGORIES["Unknown Error"];
  return {
    reason,
    category: meta.category,
    code: meta.code,
    message: reason + " — " + (meta.category === "temporary"
      ? "Temporary failure, retry recommended."
      : meta.category === "customer_action"
      ? "Customer action required."
      : meta.category === "permanent"
      ? "Permanent failure, alternative method needed."
      : "Requires further analysis."),
    recommendedAction: meta.recommendedAction,
    recommendedChannel: meta.recommendedChannel,
  };
}

// RecoveryPredictionModel — transparent scoring model.
// Inputs: transaction features + customer history.
// Output: { probability (0-100), confidence (0-100), factors[] }
export function predictRecoveryProbability(tx, customer) {
  const factors = [];
  let score = 50; // baseline

  const cls = classifyFailure(tx.failure_reason);
  // Failure category weight
  if (cls.category === "temporary") { score += 22; factors.push({ label: "Temporary failure type", impact: 22, sign: "+" }); }
  else if (cls.category === "customer_action") { score += 8; factors.push({ label: "Customer action required", impact: 8, sign: "+" }); }
  else if (cls.category === "permanent") { score -= 30; factors.push({ label: "Permanent failure type", impact: -30, sign: "-" }); }
  else { score -= 5; factors.push({ label: "Unknown failure type", impact: -5, sign: "-" }); }

  // Payment method historical success
  const methodRate = METHOD_BASE_SUCCESS[tx.payment_method] || 0.75;
  const methodBoost = Math.round((methodRate - 0.75) * 100);
  score += methodBoost;
  factors.push({ label: tx.payment_method + " historical success rate", impact: methodBoost, sign: methodBoost >= 0 ? "+" : "-" });

  // Customer payment history
  if (customer) {
    const successPct = customer.total_transactions > 0
      ? customer.successful_transactions / customer.total_transactions : 0.8;
    const custBoost = Math.round((successPct - 0.7) * 50);
    score += custBoost;
    factors.push({ label: "Customer payment history", impact: custBoost, sign: custBoost >= 0 ? "+" : "-" });

    if (customer.recovery_success_count > 0) {
      score += 10;
      factors.push({ label: "Previous successful recoveries", impact: 10, sign: "+" });
    }
    // Tenure
    if (customer.tenure_months > 12) { score += 6; factors.push({ label: "Long customer tenure", impact: 6, sign: "+" }); }
  }

  // Previous attempts — diminishing returns
  if (tx.attempts > 1) {
    const penalty = Math.min(20, (tx.attempts - 1) * 7);
    score -= penalty;
    factors.push({ label: "Multiple recent attempts", impact: -penalty, sign: "-" });
  }

  // Amount — very high amounts slightly harder
  if (tx.amount > 50000) { score -= 6; factors.push({ label: "High transaction amount", impact: -6, sign: "-" }); }
  else if (tx.amount < 2000) { score += 4; factors.push({ label: "Low transaction amount", impact: 4, sign: "+" }); }

  // Time of day factor (failed_at hour)
  const hour = tx.failed_at ? new Date(tx.failed_at).getHours() : 12;
  if (hour >= 9 && hour <= 11) { score += 8; factors.push({ label: "Optimal morning window", impact: 8, sign: "+" }); }
  else if (hour >= 18 && hour <= 20) { score += 10; factors.push({ label: "Optimal evening window", impact: 10, sign: "+" }); }
  else if (hour >= 0 && hour <= 5) { score -= 8; factors.push({ label: "Off-peak night hours", impact: -8, sign: "-" }); }

  const probability = Math.max(2, Math.min(98, Math.round(score)));
  const confidence = Math.min(96, 60 + Math.round(Math.abs(score - 50) * 0.6) + (customer ? 10 : 0));
  return { probability, confidence, factors, category: cls.category };
}

export function probabilityLabel(p) {
  if (p >= 80) return "Very High";
  if (p >= 60) return "High";
  if (p >= 40) return "Medium";
  if (p >= 20) return "Low";
  return "Very Low";
}

// Recommend an optimal retry window based on failure + method.
export function recommendRetryTime(tx) {
  const hour = tx.failed_at ? new Date(tx.failed_at).getHours() : 12;
  // Evening window is generally best for customer-action failures; morning for temporary.
  const cls = classifyFailure(tx.failure_reason);
  let start, end;
  if (cls.category === "customer_action") {
    if (hour < 18) { start = 18; end = 20; }
    else { start = 10; end = 12; }
  } else if (cls.category === "temporary") {
    const now = new Date(tx.failed_at || Date.now());
    const retry = new Date(now.getTime() + 30 * 60000);
    start = retry.getHours(); end = start + 1;
  } else {
    start = 10; end = 12;
  }
  const fmt = (h) => {
    const period = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return hr + ":00 " + period;
  };
  return {
    window: fmt(start) + " – " + fmt(end),
    delayMinutes: cls.category === "temporary" ? 30 : Math.max(60, (start - hour + 24) % 24 * 60),
  };
}

// Decide recovery strategy from probability + amount.
export function recommendStrategy(tx, prob) {
  const category = classifyFailure(tx.failure_reason).category;
  if (category === "permanent" || prob < 15 || Number(tx.attempts || 0) >= 4) {
    return { strategy: "do_not_retry", action: "Do not retry — request customer resolution", priority: "LOW" };
  }
  if (tx.amount > 50000 && prob > 70) return { strategy: "escalation", action: "Move to manual review (high-value)", priority: "CRITICAL" };
  if (prob > 80) return { strategy: "smart_retry", action: "High-priority intelligent retry", priority: "HIGH" };
  if (prob > 50) return { strategy: "adaptive", action: "Adaptive recovery (AI-chosen)", priority: "MEDIUM" };
  if (prob > 25) return { strategy: "customer_reminder", action: "Send customer reminder", priority: "MEDIUM" };
  return { strategy: "alternative_method", action: "Request alternative payment method", priority: "LOW" };
}

export const RECOVERY_ACTIONS = [
  "RETRY_NOW", "RETRY_LATER", "CHANGE_PAYMENT_METHOD", "SEND_PAYMENT_LINK",
  "SEND_REMINDER", "REQUEST_CUSTOMER_ACTION", "ESCALATE", "DO_NOT_RETRY",
];

export function expectedRecoveryValue(amount, probability, cost = 0) {
  return Math.max(0, Math.round((Number(amount || 0) * Number(probability || 0)) / 100 - Number(cost || 0)));
}

function strategyProbability(tx, baseProbability, action, customer) {
  const cls = classifyFailure(tx.failure_reason);
  const methodRate = METHOD_BASE_SUCCESS[tx.payment_method] || 0.75;
  const historyBoost = customer?.recovery_success_count > 0 ? 5 : 0;
  const adjustments = {
    RETRY_NOW: cls.category === "temporary" ? 8 : -4,
    RETRY_LATER: cls.category === "temporary" ? 5 : 3,
    CHANGE_PAYMENT_METHOD: cls.category === "permanent" ? 18 : Math.round((0.82 - methodRate) * 40) + historyBoost,
    SEND_PAYMENT_LINK: cls.category === "customer_action" ? 9 : 2,
    SEND_REMINDER: cls.category === "customer_action" ? 6 : 0,
    REQUEST_CUSTOMER_ACTION: cls.category === "customer_action" ? 8 : -2,
    ESCALATE: 4,
    DO_NOT_RETRY: -100,
  };
  return Math.max(0, Math.min(98, Math.round(baseProbability + (adjustments[action] || 0) - Math.min(20, (tx.attempts || 1) - 1) * 5)));
}

export function evaluateRecoveryStrategies(tx, customer, settings = {}) {
  const prediction = predictRecoveryProbability(tx, customer);
  const cost = Number(settings.retry_cost || 10) + Number(settings.operational_cost || 0);
  const options = RECOVERY_ACTIONS.map((action) => {
    const probability = strategyProbability(tx, prediction.probability, action, customer);
    const estimatedCost = action === "DO_NOT_RETRY" ? 0 : action === "ESCALATE" ? cost * 2 : cost;
    const timeMinutes = { RETRY_NOW: 5, RETRY_LATER: 30, CHANGE_PAYMENT_METHOD: 120, SEND_PAYMENT_LINK: 180, SEND_REMINDER: 240, REQUEST_CUSTOMER_ACTION: 360, ESCALATE: 720, DO_NOT_RETRY: 0 }[action];
    const reason = action === "DO_NOT_RETRY" && probability === 0
      ? "Failure is not economically recoverable under the current signals."
      : `${classifyFailure(tx.failure_reason).category} failure with ${probability}% estimated recovery probability.`;
    return { action, probability, expectedValue: expectedRecoveryValue(tx.amount, probability, estimatedCost), risk: 100 - probability, timeMinutes, cost: estimatedCost, reason };
  });
  const allowed = settings.allowed_payment_methods;
  const filtered = Array.isArray(allowed) && allowed.length ? options.filter((option) => option.action !== "CHANGE_PAYMENT_METHOD" || allowed.length > 1) : options;
  return filtered.sort((a, b) => b.expectedValue - a.expectedValue || b.probability - a.probability);
}

export function explainDecision(tx, prediction, selected, settings = {}) {
  const cls = classifyFailure(tx.failure_reason);
  const positive = prediction.factors.filter((factor) => factor.sign === "+").map((factor) => factor.label);
  const negative = prediction.factors.filter((factor) => factor.sign === "-").map((factor) => factor.label);
  const policyFactors = [];
  if (Number(tx.attempts || 0) >= Number(settings.max_retries || 3)) policyFactors.push("Maximum retry policy has been reached.");
  if (tx.amount >= Number(settings.escalation_threshold || 50000)) policyFactors.push("Amount exceeds the manual approval threshold.");
  return { positive, negative, policyFactors, riskFactors: [cls.category, `${tx.attempts || 1} previous attempt(s)`], confidence: prediction.confidence, reason: selected?.reason || `${cls.category} failure classified with a ${prediction.probability}% recovery probability.` };
}

export function optimizePaymentMethod(tx, transactions = []) {
  const methods = [...new Set([...(Object.keys(METHOD_BASE_SUCCESS)), ...transactions.map((item) => item.payment_method)])];
  const currentRate = methodPerformanceFor(tx.payment_method, transactions);
  const ranked = methods.map((method) => ({ method, probability: Math.round(Math.max(2, Math.min(98, (METHOD_BASE_SUCCESS[method] || 0.7) * 100 + (method === tx.payment_method ? 0 : 6)))) })).sort((a, b) => b.probability - a.probability);
  const best = ranked[0];
  return { currentMethod: tx.payment_method, recommendedMethod: best.method, expectedDifference: best.probability - currentRate, options: ranked, reason: best.method === tx.payment_method ? "Current method is the strongest available option." : `${best.method} has the strongest estimated success rate for this payment.` };
}

function methodPerformanceFor(method, transactions) {
  const rows = transactions.filter((item) => item.payment_method === method);
  if (!rows.length) return Math.round((METHOD_BASE_SUCCESS[method] || 0.7) * 100);
  return Math.round(rows.filter((item) => ["SUCCESS", "RECOVERED"].includes(item.status)).length / rows.length * 100);
}

export function recoveryHealth(transactions) {
  const methods = [...new Set(transactions.map((item) => item.payment_method).filter(Boolean))];
  const methodScore = methods.length ? methods.reduce((sum, method) => sum + methodPerformanceFor(method, transactions), 0) / methods.length : 0;
  const failed = transactions.filter((item) => item.failure_reason);
  const recovered = transactions.filter((item) => item.status === "RECOVERED");
  const retryScore = failed.length ? Math.min(100, recovered.length / failed.length * 140) : 100;
  const score = Math.round(methodScore * 0.45 + retryScore * 0.55);
  return { score, components: { paymentMethodReliability: Math.round(methodScore), retryEffectiveness: Math.round(retryScore), recoverySuccess: failed.length ? Math.round(recovered.length / failed.length * 100) : 100 } };
}

export function failureFingerprints(transactions) {
  const total = transactions.length || 1;
  const groups = {};
  transactions.filter((item) => item.failure_reason).forEach((item) => {
    const key = `${item.payment_method} · ${item.failure_reason}`;
    if (!groups[key]) groups[key] = { fingerprint: key, failures: 0, amount: 0 };
    groups[key].failures += 1;
    groups[key].amount += Number(item.amount || 0);
  });
  return Object.values(groups).map((group) => ({ ...group, rate: Math.round(group.failures / total * 1000) / 10, severity: group.amount > 100000 || group.failures > 20 ? "high" : group.failures > 8 ? "medium" : "low" })).sort((a, b) => b.amount - a.amount);
}

export function revenueLeakage(transactions) {
  return transactions.filter((item) => item.failure_reason && item.status !== "RECOVERED").map((item) => ({ transactionId: item.transaction_id, amount: item.amount, expectedValue: expectedRecoveryValue(item.amount, item.recovery_probability, 10), reason: item.attempts > 2 ? "Repeated unsuccessful attempts" : item.amount >= 50000 ? "High-value failed payment" : "Recoverable failed payment" })).sort((a, b) => b.expectedValue - a.expectedValue);
}

// Customer recovery / risk score 0-100 (lower risk = higher score).
export function calculateCustomerScore(customer) {
  if (!customer || customer.total_transactions === 0) return 50;
  const successPct = customer.successful_transactions / customer.total_transactions;
  const recoveryPct = customer.failed_transactions > 0
    ? customer.recovery_success_count / customer.failed_transactions : 0.7;
  const tenureFactor = Math.min(15, customer.tenure_months);
  let score = successPct * 60 + recoveryPct * 25 + tenureFactor;
  score = Math.max(5, Math.min(98, Math.round(score)));
  return score;
}

export function riskLevel(score) {
  if (score >= 70) return "Low";
  if (score >= 45) return "Medium";
  return "High";
}

// Opportunity score = potential revenue x recovery probability (normalized).
export function opportunityScore(amount, prob) {
  return Math.round((amount * prob) / 100);
}

// Generate AI insights from transaction dataset (deterministic).
export function generateInsights(transactions, customers) {
  const insights = [];
  if (!transactions.length) return insights;

  const failed = transactions.filter((t) => ["FAILED", "RECOVERY_PENDING", "RECOVERY_ATTEMPTED", "PERMANENTLY_FAILED"].includes(t.status));
  const recovered = transactions.filter((t) => t.status === "RECOVERED");

  // Revenue at risk
  const atRisk = failed.reduce((s, t) => s + (t.amount || 0), 0);
  if (atRisk > 0) {
    const recoverable = failed.filter((t) => (t.recovery_probability || 0) > 40);
    const recoverableAmt = recoverable.reduce((s, t) => s + t.amount, 0);
    insights.push({
      title: "₹" + formatINR(atRisk) + " of revenue currently at risk",
      explanation: "Failed payments represent recoverable revenue. " + recoverable.length + " transactions have a recovery probability above 40%.",
      metric: "₹" + formatINR(recoverableAmt) + " recoverable",
      confidence: 92,
      recommended_action: "Prioritize high-probability recovery cases in the Recovery Queue.",
      category: "opportunity",
    });
  }

  // Top failure reason
  const reasonCounts = {};
  failed.forEach((t) => { reasonCounts[t.failure_reason] = (reasonCounts[t.failure_reason] || 0) + 1; });
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  if (topReason) {
    const cls = classifyFailure(topReason[0]);
    insights.push({
      title: topReason[0] + " is the leading failure reason (" + topReason[1] + " cases)",
      explanation: "Classified as " + cls.category + ". " + cls.recommendedAction.toLowerCase() + " is the recommended response.",
      metric: topReason[1] + " failed payments",
      confidence: 88,
      recommended_action: cls.recommendedAction + " for affected transactions.",
      category: "trend",
    });
  }

  // Payment method performance
  const methodStats = {};
  transactions.forEach((t) => {
    if (!methodStats[t.payment_method]) methodStats[t.payment_method] = { total: 0, success: 0 };
    methodStats[t.payment_method].total++;
    if (t.status === "SUCCESS" || t.status === "RECOVERED") methodStats[t.payment_method].success++;
  });
  const methodEntries = Object.entries(methodStats).map(([m, s]) => ({ method: m, rate: s.success / s.total }));
  const bestMethod = methodEntries.sort((a, b) => b.rate - a.rate)[0];
  const worstMethod = methodEntries.sort((a, b) => a.rate - b.rate)[0];
  if (bestMethod && worstMethod && bestMethod.method !== worstMethod.method) {
    insights.push({
      title: bestMethod.method + " has the highest success rate (" + Math.round(bestMethod.rate * 100) + "%)",
      explanation: worstMethod.method + " underperforms at " + Math.round(worstMethod.rate * 100) + "%. Recommend alternative payment methods for failing " + worstMethod.method + " transactions.",
      metric: Math.round(bestMethod.rate * 100) + "% vs " + Math.round(worstMethod.rate * 100) + "%",
      confidence: 85,
      recommended_action: "Route " + worstMethod.method + " failures to " + bestMethod.method + " where possible.",
      category: "performance",
    });
  }

  // Recovery rate
  const recoveryRate = failed.length > 0 ? (recovered.length / (recovered.length + failed.filter((t) => t.status === "PERMANENTLY_FAILED").length || 1)) : 0;
  if (recovered.length > 0) {
    insights.push({
      title: "Recovery engine recovered " + recovered.length + " payments",
      explanation: "Automated retry scheduling and customer reminders recovered " + formatINR(recovered.reduce((s, t) => s + t.amount, 0)) + " in revenue.",
      metric: Math.round(recoveryRate * 100) + "% recovery rate",
      confidence: 90,
      recommended_action: "Continue current retry strategy; expand to remaining pending cases.",
      category: "performance",
    });
  }

  // High value at risk
  const highValue = failed.filter((t) => t.amount > 50000 && (t.recovery_probability || 0) > 60);
  if (highValue.length > 0) {
    insights.push({
      title: highValue.length + " high-value transactions need attention",
      explanation: "Transactions above ₹50,000 with strong recovery probability should be escalated to manual review.",
      metric: "₹" + formatINR(highValue.reduce((s, t) => s + t.amount, 0)) + " exposed",
      confidence: 80,
      recommended_action: "Escalate to manual review queue immediately.",
      category: "risk",
    });
  }

  return insights;
}

export function formatINR(n) {
  const num = Math.round(n || 0);
  return num.toLocaleString("en-IN");
}

export function formatCurrency(n) {
  return "₹" + formatINR(n);
}