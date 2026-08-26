import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ProbabilityBadge from "@/components/ProbabilityBadge";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatMoney, formatDateTime } from "@/lib/format";
import { predictRecoveryProbability, classifyFailure, recommendRetryTime } from "@/lib/aiEngine";
import {
  getSettings, executeRetry, scheduleRetry, sendReminder, escalateCase, closeCase,
  approvePolicy, rejectPolicy, useAlternativeMethod as setAlternativeMethod, overrideRecommendation, EVENT_TYPE_LABELS, EVENT_TYPE_BADGE,
} from "@/lib/recovery";
import {
  ArrowLeft, Brain, RotateCw, Clock, Send, AlertTriangle, XCircle,
  CheckCircle2, ShieldCheck, Sparkles, History, CreditCard,
} from "lucide-react";

const ALT_METHODS = ["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"];

export default function RecoveryCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [caseRow, setCaseRow] = useState(null);
  const [tx, setTx] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState("rejected");
  const [overrideReason, setOverrideReason] = useState("");
  const [altMethod, setAltMethod] = useState("UPI");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await localClient.entities.RecoveryCase.get(id);
      setCaseRow(c);
      const txs = await localClient.entities.Transaction.filter({ transaction_id: c.transaction_id }, null, 1);
      setTx(txs[0] || null);
      if (c.customer_id || txs[0]?.customer_id) {
        const cid = c.customer_id || txs[0]?.customer_id;
        try { const cust = await localClient.entities.Customer.filter({ customer_id: cid }, null, 1); setCustomer(cust[0] || null); } catch {}
      }
      const logs = await localClient.entities.AuditLog.list("-created_date", 200);
      const tl = (logs || []).filter((l) => l.recovery_case_id === id || (l.entity_id && l.entity_id === c.transaction_id));
      setTimeline(tl.reverse());
      setSettings(await getSettings());
    } catch {
      setCaseRow(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const analysis = tx ? predictRecoveryProbability(tx, customer) : null;
  const cls = tx ? classifyFailure(tx.failure_reason) : null;
  const rt = tx ? recommendRetryTime(tx) : null;
  const highValue = caseRow && settings ? caseRow.amount >= (settings.escalation_threshold ?? 50000) : false;
  const needsApproval = caseRow && caseRow.policy_status === "PENDING";
  const terminal = caseRow && ["RECOVERED", "CLOSED", "DISMISSED", "PERMANENTLY_FAILED"].includes(caseRow.status);

  const guard = (fn) => async (...args) => {
    if (terminal) { toast({ title: "Already processed", description: "This recovery action has already been processed.", variant: "destructive" }); return; }
    setBusy(true);
    try { await fn(...args); await load(); } catch (e) { toast({ title: "Action failed", description: e.message, variant: "destructive" }); }
    setBusy(false);
  };

  const doRetry = guard(async () => {
    if (!tx) return;
    const res = await executeRetry(tx, caseRow, settings);
    if (!res.ok) { toast({ title: "Retry blocked", description: res.message, variant: "destructive" }); return; }
    toast({ title: res.success ? "Payment recovered! 🎉" : "Retry attempted", description: res.success ? `₹${tx.amount.toLocaleString("en-IN")} recovered.` : `Attempt ${res.attempts}/${settings.max_retries}.` });
  });

  const doSchedule = guard(async () => { await scheduleRetry(caseRow, null, settings); toast({ title: "Retry scheduled", description: `Window: ${rt?.window}` }); });
  const doReminder = guard(async () => { const res = await sendReminder(caseRow); if (!res.ok) { toast({ title: "Reminder not sent", description: res.message, variant: "destructive" }); return; } toast({ title: "Reminder sent", description: `via ${caseRow.recommended_channel}` }); });
  const doEscalate = guard(async () => { await escalateCase(caseRow); toast({ title: "Case escalated", variant: "warning" }); });
  const doAlt = guard(async () => { await setAlternativeMethod(caseRow, altMethod); toast({ title: "Alternative method set", description: altMethod }); });
  const doApprove = guard(async () => { await approvePolicy(caseRow); toast({ title: "Policy approved" }); });
  const doReject = guard(async () => { await rejectPolicy(caseRow, rejectReason); setRejectReason(""); toast({ title: "Policy rejected", variant: "warning" }); });
  const doOverride = guard(async () => { await overrideRecommendation(caseRow, overrideDecision, overrideReason); setOverrideOpen(false); setOverrideReason(""); toast({ title: "Override recorded" }); });
  const doClose = guard(async () => { await closeCase(caseRow, closeReason); setShowClose(false); setCloseReason(""); toast({ title: "Case closed" }); });

  if (loading) return <LoadingState />;
  if (!caseRow) return <EmptyState title="Recovery case not found" description="This case may have been removed." action={<Button onClick={() => navigate("/recovery")}>Back to queue</Button>} />;

  return (
    <div>
      <div className="mb-4">
        <Link to="/recovery" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Back to queue</Link>
      </div>
      <PageHeader title={"Case " + caseRow.transaction_id} subtitle={caseRow.customer_name + " · " + formatMoney(caseRow.amount)}>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={caseRow.status} />
          <StatusBadge status={caseRow.priority} />
          {caseRow.risk_level && <StatusBadge status={caseRow.risk_level} />}
        </div>
      </PageHeader>

      {highValue && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-3 mb-4 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="font-medium text-orange-700 dark:text-orange-400">High-value transaction</span>
          <span className="text-muted-foreground">— above escalation threshold (₹{settings?.escalation_threshold?.toLocaleString("en-IN")}). Requires policy approval before retry.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: case info + actions */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Case Information">
            <Grid>
              <Field label="Case ID" value={caseRow.id} mono />
              <Field label="Transaction ID" value={caseRow.transaction_id} mono />
              <Field label="Customer" value={caseRow.customer_name} />
              <Field label="Amount" value={formatMoney(caseRow.amount)} />
              <Field label="Payment Method" value={caseRow.payment_method} />
              <Field label="Failure Reason" value={caseRow.failure_reason} />
              <Field label="Failure Category" value={caseRow.failure_category} />
              <Field label="Source" value={caseRow.source?.replace(/_/g, " ")} />
              <Field label="Strategy" value={caseRow.strategy?.replace(/_/g, " ")} />
              <Field label="Policy Status" value={caseRow.policy_status?.replace(/_/g, " ")} />
              <Field label="Attempts" value={caseRow.attempts + " / " + (settings?.max_retries ?? 3)} />
              <Field label="Created" value={formatDateTime(caseRow.created_date)} />
              <Field label="Scheduled At" value={caseRow.scheduled_at ? formatDateTime(caseRow.scheduled_at) : "—"} />
              <Field label="Opportunity Score" value={caseRow.opportunity_score} />
            </Grid>
            {caseRow.closure_reason && <p className="text-sm text-muted-foreground mt-3 bg-muted/40 rounded-lg p-3">Closure reason: {caseRow.closure_reason}</p>}
            {caseRow.override_reason && <p className="text-sm text-muted-foreground mt-3 bg-muted/40 rounded-lg p-3">Override reason: {caseRow.override_reason}</p>}
          </Card>

          {/* Policy approval */}
          {needsApproval && (
            <Card title="Policy Approval Required" icon={ShieldCheck} accent="amber">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Mini label="Transaction" value={caseRow.transaction_id} />
                  <Mini label="Amount" value={formatMoney(caseRow.amount)} />
                  <Mini label="Recovery Probability" value={(caseRow.recovery_probability || 0) + "%"} />
                  <Mini label="Risk" value={caseRow.risk_level} />
                  <Mini label="Recommended Action" value={caseRow.recommended_action} />
                  <Mini label="AI Recommendation" value={caseRow.ai_recommendation} />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={doApprove} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4 mr-1" /> Approve</Button>
                  <Button onClick={doReject} disabled={busy} variant="destructive"><XCircle className="w-4 h-4 mr-1" /> Reject</Button>
                  <Button onClick={() => setOverrideOpen(!overrideOpen)} disabled={busy} variant="outline"><Sparkles className="w-4 h-4 mr-1" /> Override</Button>
                </div>
                {overrideOpen && (
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Label className="whitespace-nowrap">Decision</Label>
                      <Select value={overrideDecision} onValueChange={setOverrideDecision}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approved">Approve</SelectItem><SelectItem value="rejected">Reject</SelectItem></SelectContent></Select>
                    </div>
                    <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Override reason (required)" rows={2} />
                    <Button size="sm" onClick={doOverride} disabled={busy || !overrideReason}>Submit Override</Button>
                  </div>
                )}
                {!rejectReason && needsApproval && (
                  <div className="flex items-center gap-2">
                    <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason (optional)" />
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* AI Analysis */}
          {analysis && (
            <Card title="AI Analysis" icon={Brain} accent="violet">
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
                  <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t border-violet-200 dark:border-violet-900">
                    <span className="font-medium">Final probability</span>
                    <span className="font-bold text-violet-700 dark:text-violet-400">{analysis.probability}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Mini label="Confidence" value={analysis.confidence + "%"} />
                  <Mini label="Recommended Action" value={caseRow.recommended_action} />
                  <Mini label="Retry Window" value={rt?.window} />
                  <Mini label="Channel" value={cls?.recommendedChannel} />
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800"><Sparkles className="w-3 h-3" /> Intelligent Recovery Scoring Engine</span>
                </div>
              </div>
            </Card>
          )}

          {/* Actions */}
          {!terminal && (
            <Card title="Recovery Actions">
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Button onClick={doRetry} disabled={busy || needsApproval} className="bg-emerald-600 hover:bg-emerald-700"><RotateCw className="w-4 h-4 mr-1" /> Retry</Button>
                  <Button variant="outline" onClick={doSchedule} disabled={busy || needsApproval}><Clock className="w-4 h-4 mr-1" /> Schedule</Button>
                  <Button variant="outline" onClick={doReminder} disabled={busy}><Send className="w-4 h-4 mr-1" /> Remind</Button>
                  <Button variant="outline" onClick={doEscalate} disabled={busy}><AlertTriangle className="w-4 h-4 mr-1" /> Escalate</Button>
                  <Button variant="ghost" onClick={() => setShowClose(!showClose)} disabled={busy}><XCircle className="w-4 h-4 mr-1" /> Close</Button>
                </div>
                <div className="flex items-end gap-2">
                  <div><Label className="text-xs">Alternative method</Label>
                    <Select value={altMethod} onValueChange={setAltMethod}><SelectTrigger className="w-40 mt-1"><SelectValue /></SelectTrigger><SelectContent>{ALT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={doAlt} disabled={busy}><CreditCard className="w-3.5 h-3.5 mr-1" /> Set Method</Button>
                </div>
                {showClose && (
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                    <Label>Closure reason (optional)</Label>
                    <Textarea value={closeReason} onChange={(e) => setCloseReason(e.target.value)} rows={2} placeholder="e.g. Customer requested cancellation" />
                    <Button size="sm" onClick={doClose} disabled={busy}>Confirm Close</Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {terminal && (
            <div className="rounded-xl bg-muted/40 border border-border p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
              <div><div className="font-medium">Case {caseRow.status.replace(/_/g, " ")}</div><div className="text-xs text-muted-foreground">No further recovery actions available.</div></div>
            </div>
          )}
        </div>

        {/* Right: timeline */}
        <div>
          <Card title="Recovery Timeline" icon={History}>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No events recorded yet.</p>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {timeline.map((e, i) => (
                  <li key={e.id || i} className="ml-4">
                    <span className="absolute -left-[7px] mt-1 w-3 h-3 rounded-full border-2 border-background bg-violet-500" />
                    <div className="text-xs text-muted-foreground">{formatDateTime(e.created_date)}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded-full " + (EVENT_TYPE_BADGE[e.event_type] || "bg-muted text-muted-foreground")}>{EVENT_TYPE_LABELS[e.event_type] || e.action}</span>
                    </div>
                    <div className="text-sm mt-1">{e.details || "—"}</div>
                    {e.user && e.user !== "system" && <div className="text-xs text-muted-foreground">by {e.user}</div>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children, icon: Icon, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <div className={"w-7 h-7 rounded-lg flex items-center justify-center " + (accent === "violet" ? "bg-violet-100 dark:bg-violet-950" : accent === "amber" ? "bg-amber-100 dark:bg-amber-950" : "bg-muted")}><Icon className={"w-3.5 h-3.5 " + (accent === "violet" ? "text-violet-600 dark:text-violet-400" : accent === "amber" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} /></div>}
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Grid({ children }) { return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>; }
function Field({ label, value, mono }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className={"text-sm font-medium truncate " + (mono ? "font-mono" : "")}>{value || "—"}</div></div>; }
function Mini({ label, value }) { return <div className="rounded-lg bg-background border border-border p-2"><div className="text-[10px] text-muted-foreground uppercase">{label}</div><div className="text-sm font-medium">{value || "—"}</div></div>; }