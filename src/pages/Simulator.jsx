import { useState } from "react";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ProbabilityBadge from "@/components/ProbabilityBadge";
import { classifyFailure, predictRecoveryProbability } from "@/lib/aiEngine";
import { formatMoney } from "@/lib/format";
import { createRecoveryCaseFromTransaction, getSettings } from "@/lib/recovery";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Play, FlaskConical, TrendingUp, RotateCw } from "lucide-react";

const METHODS = ["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"];
const FAILURE_TYPES = [
  { value: "success", label: "Successful Payment" },
  { value: "Insufficient Funds", label: "Insufficient Funds" },
  { value: "Bank Declined", label: "Bank Declined" },
  { value: "Network Timeout", label: "Network Timeout" },
  { value: "Authentication Failure", label: "Authentication Failure" },
  { value: "Expired Card", label: "Expired Card" },
  { value: "UPI Failure", label: "UPI Failure" },
  { value: "random", label: "Random Failure" },
];

export default function Simulator() {
  const [amount, setAmount] = useState(10000);
  const [method, setMethod] = useState("UPI");
  const [failure, setFailure] = useState("Network Timeout");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const run = async () => {
    setBusy(true);
    try {
      const isFail = failure !== "success";
      let reason = failure;
      if (failure === "random") {
        const fails = FAILURE_TYPES.filter((f) => !["success", "random"].includes(f.value));
        reason = fails[Math.floor(Math.random() * fails.length)].value;
      }
      const now = new Date().toISOString();
      const txnId = "TXN-" + Date.now().toString().slice(-8);
      const custName = "Demo Customer " + Math.floor(Math.random() * 999);
      const custEmail = "demo" + Math.floor(Math.random() * 999) + "@example.in";

      let status = "SUCCESS", recovery_probability = 95, failure_reason = "", failure_category = "", failure_code = "", failure_message = "";
      if (isFail) {
        const cls = classifyFailure(reason);
        failure_reason = reason; failure_category = cls.category; failure_code = cls.code; failure_message = cls.message;
        const prob = predictRecoveryProbability({ amount: Number(amount), payment_method: method, failure_reason: reason, attempts: 1, failed_at: now });
        recovery_probability = prob.probability;
        status = "RECOVERY_PENDING";
      }

      const tx = await localClient.entities.Transaction.create({
        transaction_id: txnId, order_id: "ORD-" + Date.now().toString().slice(-8),
        customer_id: "CUST-DEMO", customer_name: custName, customer_email: custEmail,
        amount: Number(amount), currency: "INR", payment_method: method, status,
        failure_reason, failure_category, failure_code, failure_message,
        risk_score: isFail ? 100 - recovery_probability : 5, recovery_probability,
        recovery_status: isFail ? "PENDING" : "", attempts: 1,
        failed_at: isFail ? now : null,
      });

      let recoveryCase = null;
      if (isFail) {
        const settings = await getSettings();
        const created = await createRecoveryCaseFromTransaction(tx, settings);
        recoveryCase = created.caseRow;
        await localClient.entities.Notification.create({
          type: "payment_failure", title: "Simulated payment failed",
          message: custName + " — ₹" + Number(amount).toLocaleString("en-IN") + " failed: " + reason + ". Recovery probability " + recovery_probability + "%.",
          channel: "In-app", recipient: custEmail, status: "unread", entity_id: txnId,
        });
      }
      setResult({ tx, recoveryCase, isFail, reason, recovery_probability });
      toast({ title: "Simulation complete", description: isFail ? "Failure classified and recovery case created." : "Successful payment recorded." });
    } catch (e) { toast({ title: "Simulation failed", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="Payment Simulator" subtitle="Simulate payment scenarios and watch the recovery engine respond end-to-end" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4"><FlaskConical className="w-4 h-4 text-emerald-600" /><h3 className="font-semibold">Scenario</h3></div>
          <div className="space-y-4">
            <div><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
            <div><Label>Payment Method</Label>
              <Select value={method} onValueChange={setMethod}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Outcome</Label>
              <Select value={failure} onValueChange={setFailure}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{FAILURE_TYPES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button onClick={run} disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700"><Play className="w-4 h-4 mr-1" /> {busy ? "Running…" : "Run Simulation"}</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-violet-600" /><h3 className="font-semibold">Engine Response</h3></div>
          {!result ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Run a simulation to see the AI recovery engine classify the failure, calculate probability, and create a recovery case.</div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><span className="text-muted-foreground">Transaction:</span><span className="font-mono">{result.tx.transaction_id}</span><StatusBadge status={result.tx.status} /></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{formatMoney(result.tx.amount)}</span></div>
              {result.isFail ? (
                <>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Failure</span><span>{result.reason}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Category</span><span className="capitalize">{result.tx.failure_category}</span></div>
                  <div className="rounded-lg bg-muted/40 p-3 text-xs">{result.tx.failure_message}</div>
                  <div className="flex items-center justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Recovery Probability</span><ProbabilityBadge value={result.recovery_probability} /></div>
                  {result.recoveryCase && (
                    <>
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">Recommended Action</span><span className="font-medium">{result.recoveryCase.recommended_action}</span></div>
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">Retry Window</span><span className="font-medium">{result.recoveryCase.recommended_retry_time}</span></div>
                      <div className="flex items-center justify-between"><span className="text-muted-foreground">Priority</span><StatusBadge status={result.recoveryCase.priority} /></div>
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-400">✓ Recovery case created and added to queue. Dashboard, analytics, and notifications updated.</div>
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3 text-emerald-700 dark:text-emerald-400">✓ Successful payment recorded. No recovery action needed.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* What-if simulator */}
      <WhatIfSimulator />
    </div>
  );
}

function WhatIfSimulator() {
  const [maxRetries, setMaxRetries] = useState(3);
  const [delay, setDelay] = useState(30);
  const [minProb, setMinProb] = useState(40);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const simulate = async () => {
    setBusy(true);
    try {
      const txns = await localClient.entities.Transaction.list("-created_date", 1000);
      const failed = txns.filter((t) => ["FAILED", "RECOVERY_PENDING", "RECOVERY_ATTEMPTED"].includes(t.status));
      const eligible = failed.filter((t) => (t.recovery_probability || 0) >= minProb);
      const estRecoverable = eligible.reduce((s, t) => s + t.amount * (t.recovery_probability / 100) * Math.min(1, maxRetries * 0.4), 0);
      const currentRecoverable = eligible.reduce((s, t) => s + t.amount * (t.recovery_probability / 100) * 0.5, 0);
      const improvement = currentRecoverable > 0 ? Math.round(((estRecoverable - currentRecoverable) / currentRecoverable) * 1000) / 10 : 0;
      setResult({ eligible: eligible.length, estRecoverable, currentRecoverable, improvement, attempts: eligible.length * maxRetries });
    } catch {}
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 mt-4">
      <h3 className="font-semibold mb-1">What-if Recovery Strategy Simulator</h3>
      <p className="text-xs text-muted-foreground mb-4">Estimate recovered revenue under different retry configurations vs current strategy.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div><Label>Max retries</Label><Input type="number" value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))} className="mt-1" min={1} max={5} /></div>
        <div><Label>Retry delay (min)</Label><Input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="mt-1" /></div>
        <div><Label>Min recovery probability</Label><Input type="number" value={minProb} onChange={(e) => setMinProb(Number(e.target.value))} className="mt-1" min={0} max={100} /></div>
      </div>
      <Button onClick={simulate} disabled={busy} variant="outline"><RotateCw className="w-4 h-4 mr-1" /> {busy ? "Calculating…" : "Simulate Strategy"}</Button>
      {result && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs text-muted-foreground">Eligible transactions</div><div className="text-lg font-bold">{result.eligible}</div></div>
          <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs text-muted-foreground">Current est. recovery</div><div className="text-lg font-bold">{formatMoney(result.currentRecoverable)}</div></div>
          <div className="rounded-xl bg-muted/40 p-3"><div className="text-xs text-muted-foreground">New est. recovery</div><div className="text-lg font-bold">{formatMoney(result.estRecoverable)}</div></div>
          <div className={"rounded-xl p-3 " + (result.improvement >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-rose-50 dark:bg-rose-950/40")}>
            <div className="text-xs text-muted-foreground">Improvement</div>
            <div className={"text-lg font-bold " + (result.improvement >= 0 ? "text-emerald-600" : "text-rose-600")}>{result.improvement >= 0 ? "+" : ""}{result.improvement}%</div>
          </div>
        </div>
      )}
    </div>
  );
}