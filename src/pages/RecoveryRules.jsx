import { useEffect, useState } from "react";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Power, Pencil } from "lucide-react";

const FIELDS = ["failure_reason", "amount", "recovery_probability", "payment_method"];
const OPERATORS = ["equals", "greater_than", "less_than", "contains"];
const ACTIONS = ["schedule_retry", "send_reminder", "escalate", "request_alternative"];
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function RecoveryRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setRules(await localClient.entities.RecoveryRule.list("-created_date", 100)); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const blank = { name: "", description: "", condition_field: "failure_reason", condition_operator: "equals", condition_value: "", action: "schedule_retry", action_params: "", priority: "MEDIUM", enabled: true };

  const save = async () => {
    if (!editing.name || !editing.condition_value) { toast({ title: "Name and condition value required", variant: "destructive" }); return; }
    try {
      if (editing.id) {
        await localClient.entities.RecoveryRule.update(editing.id, editing);
        await logAudit("rule_updated", "RecoveryRule", editing.name, editing.id);
        toast({ title: "Rule updated" });
      } else {
        await localClient.entities.RecoveryRule.create(editing);
        await logAudit("rule_created", "RecoveryRule", editing.name);
        toast({ title: "Rule created" });
      }
      setEditing(null); load();
    } catch (e) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  const toggle = async (r) => {
    await localClient.entities.RecoveryRule.update(r.id, { enabled: !r.enabled });
    await logAudit("rule_updated", "RecoveryRule", r.name + " " + (!r.enabled ? "enabled" : "disabled"), r.id);
    load();
  };

  const remove = async (r) => {
    await localClient.entities.RecoveryRule.delete(r.id);
    await logAudit("rule_deleted", "RecoveryRule", r.name, r.id);
    load();
  };

  if (loading) return <LoadingState />;
  return (
    <div>
      <PageHeader title="Recovery Rules" subtitle="Visual rule builder for automated recovery actions">
        <Button onClick={() => setEditing(blank)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" /> New Rule</Button>
      </PageHeader>

      {rules.length === 0 && !editing ? <EmptyState title="No rules yet" description="Create rules to automate recovery actions." action={<Button onClick={() => setEditing(blank)}><Plus className="w-4 h-4 mr-1" /> Create first rule</Button>} /> : (
        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{r.name}</span>
                    <StatusBadge status={r.priority} />
                    {!r.enabled && <span className="text-xs text-muted-foreground">· Disabled</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  <div className="mt-2 inline-flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-1.5 font-mono">
                    WHEN {r.condition_field} {r.condition_operator} <span className="font-semibold text-foreground">{r.condition_value}</span> → {r.action} ({r.action_params || "—"})
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => toggle(r)} title={r.enabled ? "Disable" : "Enable"}><Power className={"w-4 h-4 " + (r.enabled ? "text-emerald-600" : "text-muted-foreground")} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="w-4 h-4 text-rose-600" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">{editing.id ? "Edit Rule" : "New Recovery Rule"}</h3>
            <div className="space-y-3">
              <div><Label>Rule Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1" placeholder="e.g. Network Error Auto-Retry" /></div>
              <div><Label>Description</Label><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1" /></div>
              <div className="rounded-xl bg-muted/40 p-3 space-y-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Condition (WHEN)</div>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={editing.condition_field} onValueChange={(v) => setEditing({ ...editing, condition_field: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FIELDS.map((f) => <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
                  <Select value={editing.condition_operator} onValueChange={(v) => setEditing({ ...editing, condition_operator: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OPERATORS.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
                  <Input value={editing.condition_value} onChange={(e) => setEditing({ ...editing, condition_value: e.target.value })} placeholder="value" />
                </div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3 space-y-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Action (THEN)</div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={editing.action} onValueChange={(v) => setEditing({ ...editing, action: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select>
                  <Input value={editing.action_params} onChange={(e) => setEditing({ ...editing, action_params: e.target.value })} placeholder="params (e.g. 30 minutes)" />
                </div>
                <Select value={editing.priority} onValueChange={(v) => setEditing({ ...editing, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={save} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Save Rule</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}