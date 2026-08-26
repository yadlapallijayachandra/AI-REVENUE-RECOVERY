// Demo data generator — realistic Indian payment context, synthetic data only.
import { classifyFailure, predictRecoveryProbability, recommendRetryTime, recommendStrategy, calculateCustomerScore, riskLevel, opportunityScore, FAILURE_REASONS } from "./aiEngine";

const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Saanvi", "Aadhya", "Aaradhya", "Priya", "Kavya", "Pari", "Riya", "Anika", "Rohan", "Karan", "Neha", "Meera", "Tara"];
const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Reddy", "Nair", "Iyer", "Mehta", "Patel", "Singh", "Kapoor", "Joshi", "Rao", "Malhotra", "Chopra", "Bose", "Das", "Kumar", "Menon", "Pillai", "Shah"];
const METHODS = ["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"];
const MERCHANTS = ["RecoverAI Demo Merchant"];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randAmount() {
  const bucket = Math.random();
  if (bucket < 0.5) return randInt(199, 1999);
  if (bucket < 0.8) return randInt(2000, 14999);
  if (bucket < 0.95) return randInt(15000, 49999);
  return randInt(50000, 150000);
}

export function generateDemoData(opts = {}) {
  const { customerCount = 250, txCount = 1000 } = opts;
  const customers = [];
  const transactions = [];
  const now = Date.now();

  // Customers
  for (let i = 0; i < customerCount; i++) {
    const name = rand(FIRST_NAMES) + " " + rand(LAST_NAMES);
    const email = name.toLowerCase().replace(/\s+/g, ".") + randInt(1, 999) + "@example.in";
    const phone = "+91 9" + randInt(100000000, 999999999);
    const tenure = randInt(1, 36);
    customers.push({
      customer_id: "CUST-" + String(1001 + i),
      name, email, phone,
      tenure_months: tenure,
      preferred_payment_method: rand(METHODS),
      total_transactions: 0, successful_transactions: 0, failed_transactions: 0,
      lifetime_value: 0, recovery_rate: 0, recovery_success_count: 0,
      risk_score: 0, risk_level: "Low",
    });
  }

  // Transactions
  const failRate = 0.2; // ~20% fail
  for (let i = 0; i < txCount; i++) {
    const customer = rand(customers);
    const method = Math.random() < 0.45 ? customer.preferred_payment_method : rand(METHODS);
    const amount = randAmount();
    const daysAgo = randInt(0, 60);
    const ts = new Date(now - daysAgo * 86400000 - randInt(0, 86400000));
    const isFail = Math.random() < failRate;
    let status, failure_reason = "", failure_category = "", failure_code = "", failure_message = "", recovery_probability = 0, risk_score = 0, recovered_at = null, attempts = 1;

    if (isFail) {
      failure_reason = rand(FAILURE_REASONS);
      const cls = classifyFailure(failure_reason);
      failure_category = cls.category; failure_code = cls.code; failure_message = cls.message;
      attempts = randInt(1, 3);
      const prob = predictRecoveryProbability({ amount, payment_method: method, failure_reason, attempts, failed_at: ts.toISOString() }, customer);
      recovery_probability = prob.probability;
      risk_score = 100 - recovery_probability;
      // Decide eventual outcome deterministically-ish
      const r = Math.random();
      if (cls.category === "permanent") {
        status = "PERMANENTLY_FAILED";
      } else if (r < recovery_probability / 100 * 0.7) {
        status = "RECOVERED";
        recovered_at = new Date(ts.getTime() + randInt(1, 72) * 3600000).toISOString();
      } else if (r < 0.85) {
        status = Math.random() < 0.5 ? "RECOVERY_PENDING" : "RECOVERY_ATTEMPTED";
      } else {
        status = "FAILED";
      }
    } else {
      status = "SUCCESS";
      recovery_probability = randInt(85, 99);
      risk_score = randInt(2, 20);
    }

    const tx = {
      transaction_id: "TXN-" + String(100000 + i),
      order_id: "ORD-" + String(200000 + i),
      customer_id: customer.customer_id,
      customer_name: customer.name,
      customer_email: customer.email,
      amount, currency: "INR",
      payment_method: method,
      status,
      failure_reason, failure_category, failure_code, failure_message,
      risk_score, recovery_probability,
      recovery_status: status === "RECOVERED" ? "RECOVERED" : (isFail ? "PENDING" : ""),
      attempts,
      failed_at: isFail ? ts.toISOString() : null,
      recovered_at,
    };
    transactions.push(tx);

    // update customer aggregates
    customer.total_transactions++;
    if (status === "SUCCESS" || status === "RECOVERED") {
      customer.successful_transactions++;
      customer.lifetime_value += amount;
    } else {
      customer.failed_transactions++;
    }
    if (status === "RECOVERED") customer.recovery_success_count++;
  }

  // Finalize customer scores
  customers.forEach((c) => {
    c.risk_score = calculateCustomerScore(c);
    c.risk_level = riskLevel(c.risk_score);
    c.recovery_rate = c.failed_transactions > 0
      ? Math.round((c.recovery_success_count / c.failed_transactions) * 100) : 0;
  });

  // Recovery cases for failed/recoverable transactions
  const recoveryCases = [];
  transactions.filter((t) => ["FAILED", "RECOVERY_PENDING", "RECOVERY_ATTEMPTED"].includes(t.status)).forEach((t) => {
    const cls = classifyFailure(t.failure_reason);
    const rt = recommendRetryTime(t);
    const strat = recommendStrategy(t, t.recovery_probability);
    recoveryCases.push({
      transaction_id: t.transaction_id,
      order_id: t.order_id,
      customer_name: t.customer_name,
      customer_email: t.customer_email,
      amount: t.amount,
      payment_method: t.payment_method,
      failure_reason: t.failure_reason,
      failure_category: cls.category,
      recovery_probability: t.recovery_probability,
      priority: strat.priority,
      recommended_action: strat.action,
      recommended_retry_time: rt.window,
      recommended_channel: cls.recommendedChannel,
      confidence: Math.min(95, 60 + t.recovery_probability / 4),
      strategy: strat.strategy,
      status: t.status === "RECOVERY_ATTEMPTED" ? "ATTEMPTED" : "PENDING",
      scheduled_at: null,
      attempts: t.attempts,
      opportunity_score: opportunityScore(t.amount, t.recovery_probability),
    });
  });

  // Notifications
  const notifications = [];
  const recentFails = transactions.filter((t) => t.failure_reason).slice(0, 12);
  recentFails.forEach((t, i) => {
    notifications.push({
      type: i % 3 === 0 ? "high_value_risk" : "payment_failure",
      title: "Payment failed: " + t.transaction_id,
      message: t.customer_name + "'s payment of ₹" + t.amount.toLocaleString("en-IN") + " failed — " + t.failure_reason + ". Recovery probability " + t.recovery_probability + "%.",
      channel: "In-app",
      recipient: t.customer_email,
      status: i < 6 ? "unread" : "read",
      entity_id: t.transaction_id,
    });
  });
  notifications.push({
    type: "ai_recommendation",
    title: "AI recovery window identified",
    message: "32 failed payments have high recovery probability during the 6:30–8:00 PM window.",
    channel: "In-app", recipient: "ops@recoverai.local", status: "unread", entity_id: "",
  });
  notifications.push({
    type: "system_alert",
    title: "Recovery engine running",
    message: "Adaptive recovery strategy active. Monitoring 184 recoverable transactions.",
    channel: "In-app", recipient: "ops@recoverai.local", status: "read", entity_id: "",
  });

  // Audit logs
  const auditLogs = [
    { action: "login", entity: "auth", entity_id: "", user: "merchant@recoverai.local", previous_value: "", new_value: "", details: "Merchant admin signed in" },
    { action: "rule_created", entity: "RecoveryRule", entity_id: "auto", user: "merchant@recoverai.local", previous_value: "", new_value: "Network Error retry rule", details: "Auto-provisioned default rule" },
    { action: "recovery_approved", entity: "RecoveryCase", entity_id: "auto", user: "ops@recoverai.local", previous_value: "PENDING", new_value: "SCHEDULED", details: "Batch approval of 12 cases" },
    { action: "retry_triggered", entity: "Transaction", entity_id: "TXN-100042", user: "system", previous_value: "FAILED", new_value: "RECOVERY_ATTEMPTED", details: "Scheduled retry executed" },
    { action: "notification_sent", entity: "Notification", entity_id: "auto", user: "system", previous_value: "", new_value: "Email reminder", details: "Customer reminder dispatched" },
    { action: "settings_changed", entity: "Settings", entity_id: "recovery", user: "merchant@recoverai.local", previous_value: "max_retries=2", new_value: "max_retries=3", details: "Updated retry configuration" },
  ];

  // Default recovery rules
  const rules = [
    { name: "Network Error Auto-Retry", description: "Retry temporary network failures after 30 minutes", condition_field: "failure_reason", condition_operator: "equals", condition_value: "Network Timeout", action: "schedule_retry", action_params: "30 minutes", priority: "HIGH", enabled: true },
    { name: "High-Value Escalation", description: "Escalate high-value recoverable transactions", condition_field: "amount", condition_operator: "greater_than", condition_value: "50000", action: "escalate", action_params: "manual review", priority: "CRITICAL", enabled: true },
    { name: "Insufficient Funds Reminder", description: "Notify customer on insufficient funds", condition_field: "failure_reason", condition_operator: "equals", condition_value: "Insufficient Funds", action: "send_reminder", action_params: "Email", priority: "MEDIUM", enabled: true },
    { name: "Low Probability Alternative", description: "Request alternative method for low-probability failures", condition_field: "recovery_probability", condition_operator: "less_than", condition_value: "25", action: "request_alternative", action_params: "Email", priority: "LOW", enabled: false },
  ];

  return { customers, transactions, recoveryCases, notifications, auditLogs, rules };
}