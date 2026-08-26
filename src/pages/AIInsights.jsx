import { useEffect, useState } from "react";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { generateInsights } from "@/lib/aiEngine";
import { Sparkles, TrendingUp, AlertTriangle, Target, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORY_ICON = { trend: TrendingUp, opportunity: Target, risk: AlertTriangle, performance: Activity };
const CATEGORY_COLOR = {
  trend: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  opportunity: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  risk: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  performance: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
};

export default function AIInsights() {
  const [txns, setTxns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const t = await localClient.entities.Transaction.list("-created_date", 1000);
      const c = await localClient.entities.Customer.list(null, 300);
      setTxns(t || []); setCustomers(c || []);
      setInsights(generateInsights(t || [], c || []));
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveInsight = async (ins) => {
    await localClient.entities.AIInsight.create({ title: ins.title, explanation: ins.explanation, metric: ins.metric, confidence: ins.confidence, recommended_action: ins.recommended_action, category: ins.category });
    alert("Insight saved to AI Insights store.");
  };

  if (loading) return <LoadingState />;
  if (!txns.length) return <EmptyState title="No data to analyze" />;

  return (
    <div>
      <PageHeader title="AI Insights" subtitle="Generated from live transaction patterns — explainable, not random">
        <Button variant="outline" size="sm" onClick={load}><Sparkles className="w-4 h-4 mr-1" /> Regenerate</Button>
      </PageHeader>

      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white p-5 mb-4">
        <div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4" /><span className="text-sm font-medium">Recovery Intelligence Engine</span></div>
        <p className="text-sm text-violet-100">{insights.length} insights derived from {txns.length} transactions and {customers.length} customers. Every insight includes explanation, supporting metric, confidence, and recommended action.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((ins, i) => {
          const Icon = CATEGORY_ICON[ins.category] || Sparkles;
          return (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={"w-9 h-9 rounded-xl flex items-center justify-center " + CATEGORY_COLOR[ins.category]}><Icon className="w-4 h-4" /></div>
                  <span className={"text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full " + CATEGORY_COLOR[ins.category]}>{ins.category}</span>
                </div>
                <span className="text-xs text-muted-foreground">{ins.confidence}% confidence</span>
              </div>
              <h3 className="font-semibold mb-1.5">{ins.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">{ins.explanation}</p>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div><div className="text-[10px] text-muted-foreground uppercase">Metric</div><div className="text-sm font-semibold">{ins.metric}</div></div>
              </div>
              <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">→ {ins.recommended_action}</div>
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => saveInsight(ins)}>Save insight</Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}