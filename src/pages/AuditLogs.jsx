import { useEffect, useState, useMemo } from "react";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { formatDateTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, RefreshCw } from "lucide-react";
import { EVENT_TYPE_LABELS, EVENT_TYPE_BADGE, AUDIT_EVENT_TYPES } from "@/lib/recovery";

const SEVERITIES = ["ALL", "info", "warning", "error", "critical"];

// Map legacy action strings to canonical event types for filtering/display.
const ACTION_TO_EVENT = {
  login: "LOGIN", logout: "LOGOUT",
  rule_created: "RULE_CREATED", rule_updated: "RULE_UPDATED", rule_deleted: "RULE_DELETED",
  recovery_approved: "POLICY_APPROVED", recovery_dismissed: "CASE_CLOSED",
  retry_triggered: "ACTION_EXECUTED", recovery_scheduled: "RECOVERY_SCHEDULED",
  notification_sent: "NOTIFICATION_SENT", settings_changed: "SETTINGS_CHANGED",
  payment_simulated: "AI_INVOKED", export: "ACTION_EXECUTED",
};

function eventTypeOf(log) {
  if (log.event_type) return log.event_type;
  return ACTION_TO_EVENT[log.action] || (log.action ? log.action.toUpperCase() : "SYSTEM_ERROR");
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");

  const load = async () => {
    setLoading(true);
    try { setLogs(await localClient.entities.AuditLog.list("-created_date", 200)); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const et = eventTypeOf(l);
      if (eventType !== "ALL" && et !== eventType) return false;
      if (severity !== "ALL" && (l.severity || "info") !== severity) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.action?.toLowerCase().includes(q) && !l.entity?.toLowerCase().includes(q) && !l.user?.toLowerCase().includes(q) && !l.details?.toLowerCase().includes(q) && !l.entity_id?.toLowerCase().includes(q) && !l.recovery_case_id?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, eventType, severity]);

  const clearFilters = () => { setSearch(""); setEventType("ALL"); setSeverity("ALL"); };

  if (loading) return <LoadingState />;
  return (
    <div>
      <PageHeader title="Audit Logs" subtitle={filtered.length + " events recorded"}>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </PageHeader>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, entity, user, transaction, case ID…" className="pl-9" />
        </div>
        <Select value={eventType} onValueChange={setEventType}><SelectTrigger className="w-full sm:w-52"><Filter className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="Event type" /></SelectTrigger><SelectContent>{["ALL", ...AUDIT_EVENT_TYPES].map((t) => <SelectItem key={t} value={t}>{t === "ALL" ? "All events" : EVENT_TYPE_LABELS[t] || t}</SelectItem>)}</SelectContent></Select>
        <Select value={severity} onValueChange={setSeverity}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Severity" /></SelectTrigger><SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All severity" : s}</SelectItem>)}</SelectContent></Select>
        <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No audit events found" description="Try adjusting or clearing filters." action={<Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>} />
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase"><tr>
                <th className="text-left px-4 py-3">Timestamp</th><th className="text-left px-4 py-3">Event</th><th className="text-left px-4 py-3 hidden md:table-cell">Severity</th><th className="text-left px-4 py-3">Entity</th><th className="text-left px-4 py-3 hidden md:table-cell">User</th><th className="text-left px-4 py-3">Details</th><th className="text-left px-4 py-3 hidden lg:table-cell">Change</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => {
                  const et = eventTypeOf(l);
                  return (
                    <tr key={l.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(l.created_date)}</td>
                      <td className="px-4 py-3"><span className={"text-xs font-medium px-2 py-0.5 rounded-full " + (EVENT_TYPE_BADGE[et] || "bg-muted text-muted-foreground")}>{EVENT_TYPE_LABELS[et] || et.replace(/_/g, " ")}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs capitalize text-muted-foreground">{l.severity || "info"}</span></td>
                      <td className="px-4 py-3">{l.entity}{l.entity_id && <div className="text-xs text-muted-foreground font-mono">{l.entity_id}</div>}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{l.user}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.details || "—"}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{l.previous_value && <span className="line-through">{l.previous_value}</span>} {l.new_value && <span className="text-emerald-600">→ {l.new_value}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}