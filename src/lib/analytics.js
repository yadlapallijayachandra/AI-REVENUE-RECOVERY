// Analytics calculations derived from transaction data (single source of truth).
import { expectedRecoveryValue, recoveryHealth, revenueLeakage } from "./aiEngine";

export function computeMetrics(transactions) {
  const total = transactions.length;
  const success = transactions.filter((t) => t.status === "SUCCESS").length;
  const recovered = transactions.filter((t) => t.status === "RECOVERED").length;
  const failed = transactions.filter((t) => ["FAILED", "PERMANENTLY_FAILED", "RECOVERY_PENDING", "RECOVERY_ATTEMPTED"].includes(t.status));
  const permanentlyFailed = transactions.filter((t) => t.status === "PERMANENTLY_FAILED");
  const recoverable = failed.filter((t) => t.status !== "PERMANENTLY_FAILED" && (t.recovery_probability || 0) > 25);

  const revenueAtRisk = failed.reduce((s, t) => s + (t.amount || 0), 0);
  const revenueRecovered = transactions.filter((t) => t.status === "RECOVERED").reduce((s, t) => s + (t.amount || 0), 0);
  const revenueLost = permanentlyFailed.reduce((s, t) => s + (t.amount || 0), 0);
  const recoverableRevenue = recoverable.reduce((s, t) => s + (t.amount || 0), 0);
  const expectedRecovery = recoverable.reduce((s, t) => s + expectedRecoveryValue(t.amount, t.recovery_probability, 10), 0);
  const activeCases = transactions.filter((t) => ["FAILED", "RECOVERY_PENDING", "RECOVERY_ATTEMPTED"].includes(t.status)).length;

  const recoveryRate = (recovered + permanentlyFailed.length) > 0
    ? Math.round((recovered / (recovered + permanentlyFailed.length)) * 1000) / 10 : 0;

  // Avg recovery time (hours) for recovered
  const recTimes = transactions.filter((t) => t.status === "RECOVERED" && t.failed_at && t.recovered_at)
    .map((t) => (new Date(t.recovered_at) - new Date(t.failed_at)) / 3600000);
  const avgRecoveryTime = recTimes.length ? (recTimes.reduce((a, b) => a + b, 0) / recTimes.length) : 0;

  return {
    total, success, failedCount: failed.length, recovered,
    permanentlyFailed: permanentlyFailed.length,
    recoverableCount: recoverable.length,
    revenueAtRisk, revenueRecovered, revenueLost, recoverableRevenue, expectedRecovery,
    activeCases, leakageCount: revenueLeakage(transactions).length, recoveryHealth: recoveryHealth(transactions),
    recoveryRate,
    avgRecoveryTime: Math.round(avgRecoveryTime * 10) / 10,
    successRate: total ? Math.round(((success + recovered) / total) * 1000) / 10 : 0,
  };
}

export function failureReasonBreakdown(transactions) {
  const map = {};
  transactions.filter((t) => t.failure_reason).forEach((t) => {
    map[t.failure_reason] = (map[t.failure_reason] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function methodPerformance(transactions) {
  const map = {};
  transactions.forEach((t) => {
    if (!map[t.payment_method]) map[t.payment_method] = { method: t.payment_method, total: 0, success: 0, failed: 0, volume: 0 };
    map[t.payment_method].total++;
    map[t.payment_method].volume += t.amount || 0;
    if (t.status === "SUCCESS" || t.status === "RECOVERED") map[t.payment_method].success++;
    else map[t.payment_method].failed++;
  });
  return Object.values(map).map((m) => ({ ...m, rate: m.total ? Math.round((m.success / m.total) * 1000) / 10 : 0 }));
}

export function recoveryFunnel(transactions) {
  const failed = transactions.filter((t) => ["FAILED", "PERMANENTLY_FAILED", "RECOVERY_PENDING", "RECOVERY_ATTEMPTED", "RECOVERED"].includes(t.status));
  const eligible = failed.filter((t) => t.status !== "PERMANENTLY_FAILED" && (t.recovery_probability || 0) > 25);
  const attempted = transactions.filter((t) => ["RECOVERY_ATTEMPTED", "RECOVERED"].includes(t.status));
  const recovered = transactions.filter((t) => t.status === "RECOVERED");
  return [
    { stage: "Failed Payments", value: failed.length },
    { stage: "Eligible for Recovery", value: eligible.length },
    { stage: "Recovery Attempted", value: attempted.length },
    { stage: "Customer Action", value: transactions.filter((t) => t.recovery_status === "CUSTOMER_ACTION").length },
    { stage: "Payment Successful", value: recovered.length },
    { stage: "Revenue Recovered", value: recovered.length },
  ];
}

export function trendData(transactions, days = 30) {
  const now = Date.now();
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, atRisk: 0, recovered: 0, lost: 0 };
  }
  transactions.forEach((t) => {
    const key = (t.failed_at || t.created_date || t.recovered_at || "").slice(0, 10);
    if (buckets[key]) {
      if (t.failure_reason) buckets[key].atRisk += t.amount || 0;
      if (t.status === "RECOVERED") buckets[key].recovered += t.amount || 0;
      if (t.status === "PERMANENTLY_FAILED") buckets[key].lost += t.amount || 0;
    }
  });
  return Object.values(buckets);
}