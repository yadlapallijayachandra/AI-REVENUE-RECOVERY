import { useEffect, useState } from "react";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { timeAgo } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Check, CheckCheck, Trash2, Bell, AlertTriangle, TrendingUp, Sparkles, AlertCircle } from "lucide-react";

const TYPE_ICON = {
  recovery_success: TrendingUp, payment_failure: AlertTriangle, high_value_risk: AlertCircle, ai_recommendation: Sparkles, system_alert: Bell,
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setItems(await localClient.entities.Notification.list("-created_date", 100)); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const markRead = async (n) => { await localClient.entities.Notification.update(n.id, { status: "read" }); load(); };
  const markAll = async () => {
    const unread = items.filter((i) => i.status === "unread");
    await localClient.entities.Notification.bulkUpdate(unread.map((i) => ({ id: i.id, status: "read" })));
    load(); toast({ title: "All marked read" });
  };
  const clear = async (n) => { await localClient.entities.Notification.delete(n.id); load(); };

  if (loading) return <LoadingState />;
  const unread = items.filter((i) => i.status === "unread").length;

  return (
    <div>
      <PageHeader title="Notifications" subtitle={unread + " unread of " + items.length}>
        <Button variant="outline" size="sm" onClick={markAll}><CheckCheck className="w-4 h-4 mr-1" /> Mark all read</Button>
      </PageHeader>
      {items.length === 0 ? <EmptyState title="No notifications" /> : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] || Bell;
            return (
              <div key={n.id} className={"flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors " + (n.status === "unread" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "")}>
                <div className={"w-9 h-9 rounded-xl flex items-center justify-center shrink-0 " + (n.status === "unread" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600" : "bg-muted text-muted-foreground")}><Icon className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-medium text-sm">{n.title}</span>{n.status === "unread" && <span className="w-2 h-2 rounded-full bg-emerald-500" />}</div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <div className="text-xs text-muted-foreground mt-1">{n.channel} · {timeAgo(n.created_date)}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {n.status === "unread" && <Button size="icon" variant="ghost" onClick={() => markRead(n)}><Check className="w-4 h-4" /></Button>}
                  <Button size="icon" variant="ghost" onClick={() => clear(n)}><Trash2 className="w-4 h-4 text-rose-600" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}