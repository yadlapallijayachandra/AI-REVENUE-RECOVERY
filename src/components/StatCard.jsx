import { cn } from "@/lib/utils";

export default function StatCard({ label, value, sub, icon: Icon, accent = "emerald", trend }) {
  const accents = {
    emerald: "bg-emerald-500/15 text-emerald-400",
    rose: "bg-red-500/15 text-red-400",
    amber: "bg-amber-500/15 text-amber-400",
    blue: "bg-cyan-500/15 text-cyan-300",
    violet: "bg-primary/15 text-primary",
  };
  const isHealth = label === "Recovery Health";
  const healthScore = isHealth ? Number.parseInt(value, 10) || 0 : 0;
  return (
    <div className={cn("rounded-lg border bg-card p-5 transition-colors hover:border-primary/50", isHealth ? "border-primary/50 shadow-[inset_3px_0_0_hsl(var(--primary))]" : "border-border")}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        {Icon && (
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accents[accent])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      {isHealth && <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, healthScore)}%` }} /></div>}
      <div className="text-2xl font-bold font-heading text-foreground tabular-nums">{value}</div>
      {(sub || trend) && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {trend && <span className={cn("font-medium", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>{trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%</span>}
          {sub && <span className="text-muted-foreground">{sub}</span>}
        </div>
      )}
    </div>
  );
}