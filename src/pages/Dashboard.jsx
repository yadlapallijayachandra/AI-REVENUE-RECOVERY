import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { localClient } from "@/api/localDataClient";
import { useSeedData } from "@/hooks/useSeedData";
import { computeMetrics, failureReasonBreakdown, methodPerformance, recoveryFunnel, trendData } from "@/lib/analytics";
import { generateInsights, formatINR } from "@/lib/aiEngine";
import { formatCompact } from "@/lib/format";
import StatCard from "@/components/StatCard";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, AlertTriangle, Wallet, Clock, Sparkles, ArrowRight, Database, ShieldCheck } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const PIE_COLORS = ["#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#64748b", "#ec4899"];

export default function Dashboard() {
  const { loading, seeding, status, seed } = useSeedData();
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);

  const loadTx = async () => {
    setLoadingTx(true);
    try {
      const data = await localClient.entities.Transaction.list("-created_date", 1000);
      setTransactions(data || []);
    } catch {}
    setLoadingTx(false);
  };

  useEffect(() => {
    if (status === "ready") loadTx();
  }, [status]);

  if (loading) return <LoadingState label="Checking demo data…" />;
  if (status === "needs-seed") {
    return (
      <EmptyState
        title="Welcome to RecoverAI"
        description="Load the synthetic demo dataset (250 customers, 1,000+ transactions) to explore the recovery platform."
        action={<Button onClick={seed} disabled={seeding} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
          {seeding ? "Seeding demo data…" : <><Database className="w-4 h-4 mr-2" /> Load Demo Data</>}
        </Button>}
      />
    );
  }
  if (loadingTx) return <LoadingState label="Loading dashboard metrics…" />;
  if (!transactions.length) return <EmptyState title="No transactions found" description="Try reloading the demo data." />;

  const m = computeMetrics(transactions);
  const reasons = failureReasonBreakdown(transactions);
  const methods = methodPerformance(transactions);
  const funnel = recoveryFunnel(transactions);
  const trend = trendData(transactions, 30);
  const insights = generateInsights(transactions, []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-lg border border-primary/30 bg-card text-white p-6 lg:p-8 overflow-hidden relative shadow-xl shadow-black/10">
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs font-medium bg-white/10 px-3 py-1 rounded-full mb-3">
            <Sparkles className="w-3 h-3 text-emerald-400" /> AI Revenue Recovery Engine
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading tracking-tight max-w-xl">
            Recover Lost Revenue Before It's Gone.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            AI-powered payment recovery that identifies failed transactions, predicts recovery probability, and recommends the next best action.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <HeroStat label="Revenue at Risk" value={"₹" + formatINR(m.revenueAtRisk)} />
            <HeroStat label="Recovered Revenue" value={"₹" + formatINR(m.revenueRecovered)} accent="emerald" />
            <HeroStat label="Recovery Rate" value={m.recoveryRate + "%"} accent="emerald" />
            <HeroStat label="Recoverable Txns" value={m.recoverableCount} />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Transactions" value={m.total.toLocaleString("en-IN")} icon={Activity} accent="blue" />
        <StatCard label="Successful Payments" value={(m.success + m.recovered).toLocaleString("en-IN")} sub={m.successRate + "% success rate"} icon={TrendingUp} accent="emerald" />
        <StatCard label="Failed Payments" value={m.failedCount.toLocaleString("en-IN")} sub={m.permanentlyFailed + " permanent" } icon={AlertTriangle} accent="rose" />
        <StatCard label="Avg Recovery Time" value={m.avgRecoveryTime + "h"} icon={Clock} accent="violet" />
        <StatCard label="Revenue at Risk" value={formatCompact(m.revenueAtRisk)} icon={Wallet} accent="amber" />
        <StatCard label="Revenue Recovered" value={formatCompact(m.revenueRecovered)} icon={TrendingUp} accent="emerald" />
        <StatCard label="Recoverable Revenue" value={formatCompact(m.recoverableRevenue)} icon={Wallet} accent="blue" />
        <StatCard label="Revenue Lost" value={formatCompact(m.revenueLost)} icon={AlertTriangle} accent="rose" />
        <StatCard label="Expected Recovery" value={formatCompact(m.expectedRecovery)} icon={TrendingUp} accent="emerald" />
        <StatCard label="Active Recovery Cases" value={m.activeCases.toLocaleString("en-IN")} sub={m.leakageCount + " leakage signals"} icon={Activity} accent="amber" />
        <StatCard label="Recovery Health" value={m.recoveryHealth.score + "/100"} sub="Derived from outcomes" icon={ShieldCheck} accent="blue" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Revenue Recovery Trend</h3>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
            <div className="flex gap-3 text-xs">
              <Legend2 color="#f59e0b" label="At Risk" />
              <Legend2 color="#10b981" label="Recovered" />
              <Legend2 color="#ef4444" label="Lost" />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="gRisk" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tickFormatter={(v) => "₹" + (v >= 100000 ? (v / 100000).toFixed(0) + "L" : v >= 1000 ? (v / 1000).toFixed(0) + "K" : v)} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="atRisk" stroke="#f59e0b" fill="url(#gRisk)" strokeWidth={2} />
              <Area type="monotone" dataKey="recovered" stroke="#10b981" fill="url(#gRec)" strokeWidth={2} />
              <Area type="monotone" dataKey="lost" stroke="#ef4444" fillOpacity={0} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-1">Failure Reasons</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribution by category</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={reasons} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {reasons.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto">
            {reasons.slice(0, 6).map((r, i) => (
              <div key={r.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="text-muted-foreground truncate">{r.name}</span></div>
                <span className="font-medium tabular-nums">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-1">Recovery Funnel</h3>
          <p className="text-xs text-muted-foreground mb-4">Failed → Recovered conversion</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={120} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-1">Payment Method Performance</h3>
          <p className="text-xs text-muted-foreground mb-4">Success rate by method</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={methods}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="method" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="rate" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
            <div>
              <h3 className="font-semibold text-foreground">AI Recommendations</h3>
              <p className="text-xs text-muted-foreground">Generated from live transaction data</p>
            </div>
          </div>
          <Link to="/ai-insights"><Button variant="ghost" size="sm" className="text-emerald-600">View all <ArrowRight className="w-3 h-3 ml-1" /></Button></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {insights.map((ins, i) => (
            <div key={i} className="rounded-xl border border-border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/15 text-primary">{ins.category}</span>
                <span className="text-xs text-muted-foreground">{ins.confidence}% confidence</span>
              </div>
              <p className="text-sm font-medium text-foreground leading-snug">{ins.title}</p>
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{ins.explanation}</p>
              <div className="mt-3 pt-3 border-t border-border text-xs text-emerald-600 dark:text-emerald-400 font-medium">{ins.recommended_action}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, accent }) {
  return (
    <div className="rounded-md bg-elevated border border-border p-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={"text-lg lg:text-xl font-bold mt-1 " + (accent === "emerald" ? "text-emerald-400" : "text-white")}>{value}</div>
    </div>
  );
}

function Legend2({ color, label }) {
  return <div className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}</div>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover shadow-lg p-2 text-xs">
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium tabular-nums">{typeof p.value === "number" && p.value > 1000 ? "₹" + formatINR(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}