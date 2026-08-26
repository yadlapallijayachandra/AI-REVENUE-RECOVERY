import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ProbabilityBadge from "@/components/ProbabilityBadge";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { formatMoney } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  computeRecoveryMetrics, getSettings, executeRetry, scheduleRetry, sendReminder, escalateCase,
} from "@/lib/recovery";
import { RotateCw, Send, Clock, AlertTriangle, Filter, RefreshCw, Eye, IndianRupee, CheckCircle2, ShieldCheck } from "lucide-react";

const STATUS_FILTERS = ["ALL", "PENDING", "SCHEDULED", "ATTEMPTED", "ESCALATED", "RECOVERED", "CLOSED", "DISMISSED", "PERMANENTLY_FAILED"];
const SOURCE_FILTERS = ["ALL", "ai_engine", "rule_engine", "fallback", "manual"];
const RISK_FILTERS = ["ALL", "Critical", "High", "Medium", "Low"];
const SORTS = [
  { v: "opportunity", l: "Opportunity score" },
  { v: "amount", l: "Amount" },
  { v: "probability", l: "Recovery probability" },
  { v: "created", l: "Created date" },
];

export default function RecoveryQueue() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [risk, setRisk] = useState("ALL");
  const [sort, setSort] = useState("opportunity");
  const [busy, setBusy] = useState(null);
  const [settings, setSettings] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setCases(await localClient.entities.RecoveryCase.list("-created_date", 500)); } catch {}
    setLoading(false);
  };
  useEffect(() => {
    load();
    getSettings().then(setSettings);
  }, []);

  const metrics = useMemo(() => computeRecoveryMetrics(cases), [cases]);

  const filtered = useMemo(() => {
    let list = cases.filter((c) =>
      (status === "ALL" || c.status === status) &&
      (source === "ALL" || c.source === source) &&
      (risk === "ALL" || c.risk_level === risk)
    );
    list = [...list].sort((a, b) => {
      if (sort === "amount") return (b.amount || 0) - (a.amount || 0);
      if (sort === "probability") return (b.recovery_probability || 0) - (a.recovery_probability || 0);
      if (sort === "created") return new Date(b.created_date) - new Date(a.created_date);
      return (b.opportunity_score || 0) - (a.opportunity_score || 0);
    });
    return list;
  }, [cases, status, source, risk, sort]);

  const activeFiltered = useMemo(
    () => filtered.filter((c) => ["PENDING", "SCHEDULED", "ATTEMPTED", "ESCALATED"].includes(c.status)),
    [filtered]
  );
  const filteredAtRisk = activeFiltered.reduce((s, c) => s + (c.amount || 0), 0);
  const filteredRecovered = filtered.filter((c) => c.status === "RECOVERED").reduce((s, c) => s + (c.amount || 0), 0);
  const filteredApproved = filtered.filter((c) => c.policy_status === "APPROVED").length;

  const clearFilters = () => { setStatus("ALL"); setSource("ALL"); setRisk("ALL"); };

  const action = async (c, kind) => {
    if (["RECOVERED", "CLOSED", "DISMISSED", "PERMANENTLY_FAILED"].includes(c.status)) {
      toast({ title: "Already processed", description: "This recovery action has already been processed.", variant: "destructive" });
      return;
    }
    setBusy(c.id);
    try {
      const txs = await localClient.entities.Transaction.filter({ transaction_id: c.transaction_id }, null, 1);
      const tx = txs[0];
      if (kind === "retry") {
        if (!tx) { toast({ title: "Transaction not found", variant: "destructive" }); return; }
        if (c.policy_status === "PENDING") { toast({ title: "Approval required", description: "Open the case to approve this high-value recovery.", variant: "destructive" }); return; }
        const res = await executeRetry(tx, c, settings);
        if (!res.ok) { toast({ title: "Retry blocked", description: res.message, variant: "destructive" }); return; }
        toast({ title: res.success ? "Recovered! 🎉" : "Retry attempted", description: res.success ? `₹${c.amount.toLocaleString("en-IN")} recovered.` : `Attempt ${res.attempts}/${settings?.max_retries ?? 3}.` });
      } else if (kind === "schedule") {
        const res = await scheduleRetry(c, null, settings);
        if (!res.ok) { toast({ title: "Blocked", description: res.message, variant: "destructive" }); return; }
        toast({ title: "Retry scheduled" });
      } else if (kind === "reminder") {
        const res = await sendReminder(c);
        if (!res.ok) { toast({ title: "Reminder not sent", description: res.message, variant: "destructive" }); return; }
        toast({ title: "Reminder sent" });
      } else if (kind === "escalate") {
        await escalateCase(c);
        toast({ title: "Case escalated", variant: "warning" });
      }
      load();
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    setBusy(null);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Recovery Queue" subtitle={filtered.length + " cases ranked by recovery opportunity"}>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </PageHeader>

      {/* Dynamic dashboard cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MetricCard icon={Eye} label="Visible Cases" value={metrics.visible} tint="text-blue-600 bg-blue-50 dark:bg-blue-950/40" />
        <MetricCard icon={IndianRupee} label="Amount at Risk" value={formatMoney(metrics.atRisk)} tint="text-amber-600 bg-amber-50 dark:bg-amber-950/40" />
        <MetricCard icon={CheckCircle2} label="Recovered" value={formatMoney(metrics.recoveredAmount)} tint="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" />
        <MetricCard icon={ShieldCheck} label="Policy Approved" value={metrics.policyApproved} tint="text-violet-600 bg-violet-50 dark:bg-violet-950/40" />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-1 text-sm text-muted-foreground"><Filter className="w-4 h-4" /> Filters</div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
        <Select value={source} onValueChange={setSource}><SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Source" /></SelectTrigger><SelectContent>{SOURCE_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All sources" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
        <Select value={risk} onValueChange={setRisk}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Risk" /></SelectTrigger><SelectContent>{RISK_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All risk" : s}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Sort" /></SelectTrigger><SelectContent>{SORTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select>
        <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">Clear</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No recovery cases match your filters" description="Try adjusting or clearing filters." action={<Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const terminal = ["RECOVERED", "CLOSED", "DISMISSED", "PERMANENTLY_FAILED"].includes(c.status);
            const needsApproval = c.policy_status === "PENDING";
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={"/recovery/" + c.id} className="font-mono text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">{c.transaction_id}</Link>
                      <StatusBadge status={c.priority} />
                      <StatusBadge status={c.status} />
                      {c.risk_level && <StatusBadge status={c.risk_level} />}
                      {needsApproval && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Approval required</span>}
                    </div>
                    <div className="font-medium mt-1">{c.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{c.payment_method} · {c.failure_reason} · <span className="capitalize">{(c.source || "ai_engine").replace(/_/g, " ")}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{formatMoney(c.amount)}</div>
                    <div className="text-xs text-muted-foreground">Score: {c.opportunity_score}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <ProbabilityBadge value={c.recovery_probability} />
                  <span className="text-xs text-muted-foreground">Window: <span className="font-medium text-foreground">{c.recommended_retry_time}</span></span>
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-3 font-medium">{c.recommended_action}</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy === c.id || terminal || needsApproval} onClick={() => action(c, "retry")} className="bg-emerald-600 hover:bg-emerald-700"><RotateCw className="w-3.5 h-3.5 mr-1" /> Retry</Button>
                  <Button size="sm" variant="outline" disabled={busy === c.id || terminal || needsApproval} onClick={() => action(c, "schedule")}><Clock className="w-3.5 h-3.5 mr-1" /> Schedule</Button>
                  <Button size="sm" variant="outline" disabled={busy === c.id || terminal} onClick={() => action(c, "reminder")}><Send className="w-3.5 h-3.5 mr-1" /> Remind</Button>
                  <Button size="sm" variant="outline" disabled={busy === c.id || terminal} onClick={() => action(c, "escalate")}><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Escalate</Button>
                  <Link to={"/recovery/" + c.id}><Button size="sm" variant="ghost">Details</Button></Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={"w-9 h-9 rounded-xl flex items-center justify-center " + tint}><Icon className="w-4 h-4" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold tabular-nums">{value}</div>
        </div>
      </div>
    </div>
  );
}