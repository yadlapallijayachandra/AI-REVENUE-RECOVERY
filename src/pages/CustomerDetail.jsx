import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { localClient } from "@/api/localDataClient";
import StatusBadge from "@/components/StatusBadge";
import ProbabilityBadge from "@/components/ProbabilityBadge";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { formatMoney, formatCompact, formatDateTime } from "@/lib/format";
import { calculateCustomerScore, riskLevel } from "@/lib/aiEngine";
import { ArrowLeft, Mail, Phone, TrendingUp, AlertTriangle, Award, Clock } from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = await localClient.entities.Customer.get(id);
        setCustomer(c);
        const t = await localClient.entities.Transaction.filter({ customer_id: c.customer_id }, "-created_date", 20);
        setTxns(t || []);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <LoadingState />;
  if (!customer) return <EmptyState title="Customer not found" action={<Button onClick={() => navigate("/customers")}>Back to customers</Button>} />;

  const score = calculateCustomerScore(customer);
  const successPct = customer.total_transactions > 0 ? Math.round((customer.successful_transactions / customer.total_transactions) * 100) : 0;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="mb-3"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-semibold">{customer.name.charAt(0)}</div>
            <div>
              <h1 className="text-xl font-bold">{customer.name}</h1>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {customer.email}</span>
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {customer.phone}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">{customer.customer_id} · {customer.tenure_months} months tenure</div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground uppercase">Recovery Score</div>
            <div className="text-3xl font-bold text-emerald-600">{score}</div>
            <StatusBadge status={riskLevel(score)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon={TrendingUp} label="Lifetime Value" value={formatCompact(customer.lifetime_value)} />
        <Stat icon={Award} label="Success Rate" value={successPct + "%"} />
        <Stat icon={AlertTriangle} label="Failed Txns" value={customer.failed_transactions} />
        <Stat icon={Clock} label="Recovery Rate" value={customer.recovery_rate + "%"} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-4">
        <h3 className="font-semibold mb-3">Customer Behavior</h3>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">Customer has completed <span className="font-medium text-foreground">{customer.successful_transactions}/{customer.total_transactions}</span> previous payments.</p>
          <p className="text-muted-foreground">Historical recovery success: <span className="font-medium text-foreground">{customer.recovery_rate}%</span></p>
          <p className="text-muted-foreground">Preferred payment method: <span className="font-medium text-foreground">{customer.preferred_payment_method}</span></p>
          <p className="text-muted-foreground">Account age: <span className="font-medium text-foreground">{customer.tenure_months} months</span> · Recovery successes: <span className="font-medium text-foreground">{customer.recovery_success_count}</span></p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border"><h3 className="font-semibold">Recent Transactions</h3></div>
        {txns.length === 0 ? <EmptyState title="No transactions" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase"><tr>
                <th className="text-left px-4 py-2">Transaction</th><th className="text-right px-4 py-2">Amount</th><th className="text-left px-4 py-2">Method</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Recovery</th><th className="text-left px-4 py-2">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {txns.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2 font-mono text-xs">{t.transaction_id}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatMoney(t.amount)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{t.payment_method}</td>
                    <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-2">{t.failure_reason ? <ProbabilityBadge value={t.recovery_probability} /> : "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(t.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground uppercase mb-1"><Icon className="w-3.5 h-3.5" /> {label}</div><div className="text-xl font-bold">{value}</div></div>;
}