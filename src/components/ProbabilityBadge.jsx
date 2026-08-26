import { cn } from "@/lib/utils";
import { probabilityLabel } from "@/lib/aiEngine";

export default function ProbabilityBadge({ value, className }) {
  const p = Number(value || 0);
  const label = probabilityLabel(p);
  const color = p >= 60 ? "text-emerald-400" : p >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", p >= 60 ? "bg-emerald-500" : p >= 40 ? "bg-amber-500" : "bg-red-500")} style={{ width: p + "%" }} />
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", color)}>{p}%</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide hidden sm:inline">{label}</span>
    </div>
  );
}