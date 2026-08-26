import { useState, useEffect } from "react";
import { localClient } from "@/api/localDataClient";
import { X, Brain, RotateCw, Clock, Send, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import ProbabilityBadge from "@/components/ProbabilityBadge";
import { predictRecoveryProbability, classifyFailure, recommendRetryTime, recommendStrategy } from "@/lib/aiEngine";
import { formatMoney, formatDateTime } from "@/lib/format";
import { executeRetry, scheduleRetry, sendReminder, getSettings } from "@/lib/recovery";
import { useToast } from "@/components/ui/use-toast";

export default function TransactionDetailDrawer({ transaction, onClose }) {
  const [tx, setTx] = useState(transaction);
  const [customer, setCustomer] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setTx(transaction);
    if (transaction?.customer_id) {
      localClient.entities.Customer.filter({ customer_id: transaction.customer_id }, null, 1).then((c) => setCustomer(c[0] || null)).catch(() => {});
    }
  }, [transaction]);

  const analysis = predictRecoveryProbability(tx, customer);
  const cls = classifyFailure(tx.failure_reason);
  const rt = recommendRetryTime(tx);
  const strat = recommendStrategy(tx, analysis.probability);

  const refreshTx = async () => {
    const updated = await localClient.entities.Transaction.get(tx.id);
    setTx(updated);
  };

  const runAction = async (kind) => {
    setBusy(true);
    try {
      const settings = await getSettings();
      const cases = await localClient.entities.RecoveryCase.filter({ transaction_id: tx.transaction_id }, null, 1);
      const caseRow = cases[0] || null;
      if (kind === "retry") {
        const res = await executeRetry(tx, caseRow, settings);
        if (!res.ok) { toast({ title: "Retry blocked", description: res.message, variant: "destructive" }); }
        else toast({ title: res.success ? "Payment recovered! 🎉" : "Retry attempted", description: res.success ? "₹" + tx.amount.toLocaleString("en-IN") + " recovered." : `Attempt ${res.attempts}/${settings.max_retries}.` });
      } else if (kind === "schedule") {
        const when = new Date(Date.now() + rt.delayMinutes * 60000).toISOString();
        if (caseRow) {
          const res = await scheduleRetry(caseRow, when, settings);
          if (!res.ok) { toast({ title: "Blocked", description: res.message, variant: "destructive" }); }
          else toast({ title: "Retry scheduled", description: "Window: " + rt.window });
        } else {
          await localClient.entities.Transaction.update(tx.id, { status: "RECOVERY_PENDING", recovery_status: "SCHEDULED" });
          toast({ title: "Retry scheduled", description: "Window: " + rt.window });
        }
      } else if (kind === "reminder") {
        if (caseRow) {
          const res = await sendReminder(caseRow);
          if (!res.ok) { toast({ title: "Reminder not sent", description: res.message, variant: "destructive" }); return; }
        }
        else {
          if (cls.recommendedChannel !== "In-app") { toast({ title: "Reminder not sent", description: `${cls.recommendedChannel} delivery is not configured. No reminder was sent.`, variant: "destructive" }); return; }
          await localClient.entities.Notification.create({
            type: "payment_failure", title: "Payment reminder sent",
            message: "Reminder sent to " + tx.customer_name + " via " + cls.recommendedChannel + ".",
            channel: cls.recommendedChannel, recipient: tx.customer_email, status: "unread", entity_id: tx.transaction_id,
          });
        }
        toast({ title: "Reminder sent", description: cls.recommendedChannel + " notification dispatched." });
      }
      await refreshTx();
    } catch (e) { toast({ title: "Action failed", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 bg-background/90 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs text-muted-foreground font-mono">{tx.transaction_id}</div>
            <div className="font-semibold text-lg">{formatMoney(tx.amount)} <span className="text-sm font-normal text-muted-foreground">· {tx.payment_method}</span></div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-3">
            <StatusBadge status={tx.status} />
            {tx.failure_reason && <span className="text-sm text-muted-foreground">{tx.failure_reason}</span>}
          </div>

          {/* Transaction info */}
          <Section title="Transaction Information">
            <Grid>
              <Field label="Order ID" value={tx.order_id} />
              <Field label="Currency" value={tx.currency} />
              <Field label="Customer" value={tx.customer_name} />
              <Field label="Email" value={tx.customer_email} />
              <Field label="Created" value={formatDateTime(tx.created_date)} />
              <Field label="Attempts" value={tx.attempts || 1} />
            </Grid>
          </Section>

          {/* Failure info */}
          {tx.failure_reason && (
            <Section title="Failure Information">
              <Grid>
                <Field label="Failure Code" value={tx.failure_code} mono />
                <Field label="Category" value={tx.failure_category} />
                <Field label="Failed At" value={formatDateTime(tx.failed_at)} />
                <Field label="Severity" value={analysis.probability > 60 ? "Recoverable" : analysis.probability > 30 ? "Moderate" : "Critical"} />
              </Grid>
              <p className="text-sm text-muted-foreground mt-3 bg-muted/40 rounded-lg p-3">{tx.failure_message}</p>
            </Section>
          )}

          {/* AI Analysis */}
          {tx.failure_reason && (
            <Section title="AI Analysis" icon={Brain} accent="violet">
              <div className="rounded-xl border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Recovery Probability</span>
                  <ProbabilityBadge value={analysis.probability} />
                </div>
                <div className="space-y-1.5 mb-4">
                  {analysis.factors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className={f.sign === "+" ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>{f.sign}{f.impact}%</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Mini label="Recommended Action" value={strat.action} />
                  <Mini label="Recommended Window" value={rt.window} />
                  <Mini label="Recommended Channel" value={cls.recommendedChannel} />
                  <Mini label="Confidence" value={analysis.confidence + "%"} />
                </div>
                <p className="text-xs text-muted-foreground mt-3 italic">"{analysis.probability > 60 ? "Historical behavior indicates strong recovery likelihood during the recommended window." : "Recovery is uncertain; consider alternative payment methods."}"</p>
              </div>
            </Section>
          )}

          {/* Actions */}
          {tx.failure_reason && !["RECOVERED", "PERMANENTLY_FAILED"].includes(tx.status) && (
            <Section title="Recovery Actions">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => runAction("retry")} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700"><RotateCw className="w-4 h-4 mr-1" /> Retry Now</Button>
                <Button variant="outline" onClick={() => runAction("schedule")} disabled={busy}><Clock className="w-4 h-4 mr-1" /> Schedule Retry</Button>
                <Button variant="outline" onClick={() => runAction("reminder")} disabled={busy}><Send className="w-4 h-4 mr-1" /> Send Reminder</Button>
                <div className="flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-lg"><Sparkles className="w-3 h-3 mr-1" /> AI recommended</div>
              </div>
            </Section>
          )}

          {tx.status === "RECOVERED" && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div><div className="font-medium text-emerald-700 dark:text-emerald-400">Payment Recovered</div><div className="text-xs text-muted-foreground">Recovered at {formatDateTime(tx.recovered_at)}</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, icon: Icon, accent }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <div className={"w-7 h-7 rounded-lg flex items-center justify-center " + (accent === "violet" ? "bg-violet-100 dark:bg-violet-950" : "bg-muted")}><Icon className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /></div>}
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Grid({ children }) { return <div className="grid grid-cols-2 gap-3">{children}</div>; }
function Field({ label, value, mono }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className={"text-sm font-medium " + (mono ? "font-mono" : "")}>{value || "—"}</div></div>; }
function Mini({ label, value }) { return <div className="rounded-lg bg-background border border-border p-2"><div className="text-[10px] text-muted-foreground uppercase">{label}</div><div className="text-sm font-medium">{value}</div></div>; }