import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  SUCCESS: "bg-emerald-500/15 text-emerald-400",
  RECOVERED: "bg-emerald-500/15 text-emerald-400",
  FAILED: "bg-red-500/15 text-red-400",
  PERMANENTLY_FAILED: "bg-red-500/15 text-red-400",
  PENDING: "bg-amber-500/15 text-amber-400",
  PROCESSING: "bg-cyan-500/15 text-cyan-300",
  RECOVERY_PENDING: "bg-cyan-500/15 text-cyan-300",
  RECOVERY_ATTEMPTED: "bg-primary/15 text-primary",
  SCHEDULED: "bg-cyan-500/15 text-cyan-300",
  ATTEMPTED: "bg-primary/15 text-primary",
  DISMISSED: "bg-muted text-muted-foreground",
  ESCALATED: "bg-amber-500/15 text-amber-400",
  CLOSED: "bg-muted text-muted-foreground",
  CRITICAL: "bg-red-500/15 text-red-400",
  HIGH: "bg-amber-500/15 text-amber-400",
  MEDIUM: "bg-amber-500/15 text-amber-400",
  LOW: "bg-muted text-muted-foreground",
  Low: "bg-emerald-500/15 text-emerald-400",
  Medium: "bg-amber-500/15 text-amber-400",
  High: "bg-red-500/15 text-red-400",
};

export default function StatusBadge({ status, className }) {
  const style = STATUS_STYLES[status] || "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", style, className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status ? status.replace(/_/g, " ") : "—"}
    </span>
  );
}