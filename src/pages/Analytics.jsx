import { useEffect, useState, useMemo } from "react";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { computeMetrics, failureReasonBreakdown, methodPerformance, trendData } from "@/lib/analytics";
import { formatCompact } from "@/lib/format";
import { formatINR } from "@/lib/aiEngine";
import { TrendingUp, AlertTriangle, Wallet, Clock, Target, Percent, Activity } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Button } from "@/components/ui/button";

const RANGES = [{ k: 7, l: "7 Days" }, { k: 30, l: "30 Days" }, { k: 60, l: "60 Days" }];
const PIE_COLORS = ["#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#64748b", "#ec4899"];

export default function Analytics() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  useEffect(() => {
    localClient.entities.Transaction.list("-created_date", 1000).then((t) => { setTxns(t || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - range * 86400000;
    return txns.filter((t) => new Date(t.created_date).getTime() >= cutoff);
  }, [txns, range]);

  const m = computeMetrics(filtered);
  const trend = trendData(filtered, range);
  const reasons = failureReasonBreakdown(filtered);
  const methods = methodPerformance(filtered);
  const recoveryRoi = m.revenueRecovered > 0 ? Math.round((m.revenueRecovered / Math.max(1, m.recoverableCount * 5)) * 100) / 100 : 0;

  if (loading) return <LoadingState />;
  if (!txns.length) return <EmptyState title="No data" />;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Recovery performance and revenue metrics">
        {RANGES.map((r) => <Button key={r.k} size="sm" variant={range === r.k ? "default" : "outline"} onClick={() => setRange(r.k)}>{r.l}</Button>)}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Gross Payment Volume" value={formatCompact(filtered.reduce((s, t) => s + t.amount, 0))} icon={Activity} accent="blue" />
        <StatCard label="Failed Payment Volume" value={formatCompact(m.revenueAtRisk + m.revenueLost)} icon={AlertTriangle} accent="rose" />
        <StatCard label="Revenue Recovered" value={formatCompact(m.revenueRecovered)} icon={TrendingUp} accent="emerald" />
        <StatCard label="Recovery ROI" value={recoveryRoi + "x"} icon={Target} accent="violet" />
        <StatCard label="Revenue at Risk" value={formatCompact(m.revenueAtRisk)} icon={Wallet} accent="amber" />
        <StatCard label="Recovery Rate" value={m.recoveryRate + "%"} icon={Percent} accent="emerald" />
        <StatCard label="Avg Recovery Time" value={m.avgRecoveryTime + "h"} icon={Clock} accent="blue" />
        <StatCard label="Revenue Lost" value={formatCompact(m.revenueLost)} icon={AlertTriangle} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Daily Recovery Trend">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs><linearGradient id="a1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => "₹" + (v >= 100000 ? (v / 100000).toFixed(0) + "L" : v >= 1000 ? (v / 1000).toFixed(0) + "K" : v)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => "₹" + formatINR(v)} />
              <Area type="monotone" dataKey="recovered" stroke="#10b981" fill="url(#a1)" strokeWidth={2} />
              <Area type="monotone" dataKey="atRisk" stroke="#f59e0b" fillOpacity={0} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Failure Reason Trend">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={reasons} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
              <Tooltip />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Payment Method Performance">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={methods}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="method" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={28} />
              <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Failure Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={reasons} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {reasons.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold mb-4">{title}</h3>{children}</div>;
}