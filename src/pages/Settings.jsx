import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/recovery";
import { useToast } from "@/components/ui/use-toast";
import { Building2, CreditCard, LifeBuoy, Bell, Sparkles, Shield, Users, ScrollText, Loader2 } from "lucide-react";

const TABS = [
  { k: "business", label: "Business", icon: Building2 },
  { k: "payment", label: "Payment", icon: CreditCard },
  { k: "recovery", label: "Recovery", icon: LifeBuoy },
  { k: "notification", label: "Notifications", icon: Bell },
  { k: "ai", label: "AI", icon: Sparkles },
  { k: "security", label: "Security", icon: Shield },
  { k: "users", label: "User Management", icon: Users },
  { k: "audit", label: "Audit Logs", icon: ScrollText },
];

export default function Settings() {
  const [tab, setTab] = useState("business");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getSettings().then((s) => { setSettings(s); setLoaded(true); });
  }, []);

  const set = (k, v) => setSettings({ ...settings, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      toast({ title: "Settings saved", description: "Recovery policy updated — retry limits and thresholds now govern recovery actions." });
    } catch (e) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your recovery platform" />
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        <div className="rounded-2xl border border-border bg-card p-2 h-fit">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={"w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors " + (tab === t.k ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground hover:bg-muted")}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          {tab === "business" && (
            <>
              <h3 className="font-semibold">Business Information</h3>
              <div><Label>Business Name</Label><Input value={settings.business_name} onChange={(e) => set("business_name", e.target.value)} className="mt-1" /></div>
              <div><Label>Business Email</Label><Input value={settings.business_email} onChange={(e) => set("business_email", e.target.value)} className="mt-1" /></div>
              <div><Label>Industry</Label><Input value={settings.industry} onChange={(e) => set("industry", e.target.value)} className="mt-1" /></div>
            </>
          )}
          {tab === "payment" && (
            <>
              <h3 className="font-semibold">Payment Configuration</h3>
              <p className="text-sm text-muted-foreground">Supported payment methods and processing preferences.</p>
              {["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"].map((m) => (
                <div key={m} className="flex items-center justify-between rounded-lg border border-border p-3"><span className="text-sm font-medium">{m}</span><Switch checked={(settings.allowed_payment_methods || []).includes(m)} onCheckedChange={(enabled) => set("allowed_payment_methods", enabled ? [...new Set([...(settings.allowed_payment_methods || []), m])] : (settings.allowed_payment_methods || []).filter((method) => method !== m))} /></div>
              ))}
            </>
          )}
          {tab === "recovery" && (
            <>
              <h3 className="font-semibold">Recovery Settings</h3>
              <div className="flex items-center justify-between"><div><div className="text-sm font-medium">Automatic retry</div><div className="text-xs text-muted-foreground">Enable AI-scheduled retries</div></div><Switch checked={settings.auto_retry} onCheckedChange={(v) => set("auto_retry", v)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Max retries</Label><Input type="number" value={settings.max_retries} onChange={(e) => set("max_retries", Number(e.target.value))} className="mt-1" /></div>
                <div><Label>Retry interval (min)</Label><Input type="number" value={settings.retry_interval} onChange={(e) => set("retry_interval", Number(e.target.value))} className="mt-1" /></div>
                <div><Label>Min recovery probability</Label><Input type="number" value={settings.min_recovery_probability} onChange={(e) => set("min_recovery_probability", Number(e.target.value))} className="mt-1" /></div>
                <div><Label>Escalation threshold (₹)</Label><Input type="number" value={settings.escalation_threshold} onChange={(e) => set("escalation_threshold", Number(e.target.value))} className="mt-1" /></div>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="text-sm font-medium mb-2">Recovery Costs (ROI)</div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Notification cost (₹)</Label><Input type="number" value={settings.notification_cost} onChange={(e) => set("notification_cost", Number(e.target.value))} className="mt-1" /></div>
                  <div><Label>Retry cost (₹)</Label><Input type="number" value={settings.retry_cost} onChange={(e) => set("retry_cost", Number(e.target.value))} className="mt-1" /></div>
                  <div><Label>Operational cost (₹)</Label><Input type="number" value={settings.operational_cost} onChange={(e) => set("operational_cost", Number(e.target.value))} className="mt-1" /></div>
                </div>
              </div>
            </>
          )}
          {tab === "notification" && (
            <>
              <h3 className="font-semibold">Notification Preferences</h3>
              <div className="flex items-center justify-between"><div><div className="text-sm font-medium">Email notifications</div></div><Switch checked={settings.email_notifications} onCheckedChange={(v) => set("email_notifications", v)} /></div>
              <div className="flex items-center justify-between"><div><div className="text-sm font-medium">SMS notifications</div></div><Switch checked={settings.sms_notifications} onCheckedChange={(v) => set("sms_notifications", v)} /></div>
              <div className="flex items-center justify-between"><div><div className="text-sm font-medium">In-app notifications</div></div><Switch checked={settings.inapp_notifications} onCheckedChange={(v) => set("inapp_notifications", v)} /></div>
            </>
          )}
          {tab === "ai" && (
            <>
              <h3 className="font-semibold">AI Settings</h3>
              <div><Label>Recovery model</Label>
                <Select value={settings.ai_model} onValueChange={(v) => set("ai_model", v)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="transparent_scoring">Transparent Scoring (default)</SelectItem>
                </SelectContent></Select>
              </div>
              <div><Label>Confidence threshold (%)</Label><Input type="number" value={settings.ai_confidence_threshold} onChange={(e) => set("ai_confidence_threshold", Number(e.target.value))} className="mt-1" /></div>
              <div className="flex items-center justify-between"><div><div className="text-sm font-medium">Explainability</div><div className="text-xs text-muted-foreground">Show factor breakdown for every prediction</div></div><Switch checked={settings.explainability} onCheckedChange={(v) => set("explainability", v)} /></div>
            </>
          )}
          {tab === "security" && (
            <>
              <h3 className="font-semibold">Security Settings</h3>
              <div className="flex items-center justify-between"><div><div className="text-sm font-medium">Two-factor authentication</div><div className="text-xs text-muted-foreground">Require 2FA for admin accounts</div></div><Switch checked={settings.two_factor} onCheckedChange={(v) => set("two_factor", v)} /></div>
              <div><Label>Session timeout (min)</Label><Input type="number" value={settings.session_timeout} onChange={(e) => set("session_timeout", Number(e.target.value))} className="mt-1" /></div>
              <div><Label>IP whitelist (comma separated)</Label><Input value={settings.ip_whitelist} onChange={(e) => set("ip_whitelist", e.target.value)} className="mt-1" placeholder="e.g. 192.168.1.0/24" /></div>
            </>
          )}
          {tab === "users" && (
            <>
              <h3 className="font-semibold">User Management</h3>
              <p className="text-sm text-muted-foreground">Roles: Merchant Admin, Operations Manager, Analyst. Invite users by email with their assigned role.</p>
              <div className="space-y-2">
                {[{ n: "Merchant Admin", e: "merchant@recoverai.local", r: "admin" }, { n: "Ops Manager", e: "ops@recoverai.local", r: "operations" }, { n: "Analyst", e: "analyst@recoverai.local", r: "analyst" }].map((u) => (
                  <div key={u.e} className="flex items-center justify-between rounded-lg border border-border p-3"><div><div className="text-sm font-medium">{u.n}</div><div className="text-xs text-muted-foreground">{u.e}</div></div><span className="text-xs px-2 py-0.5 rounded-full bg-muted">{u.r}</span></div>
                ))}
              </div>
            </>
          )}
          {tab === "audit" && (
            <>
              <h3 className="font-semibold">Audit Configuration</h3>
              <p className="text-sm text-muted-foreground">All sensitive actions are logged automatically. Configure retention below.</p>
              <div><Label>Log retention (days)</Label><Input type="number" defaultValue={90} className="mt-1" /></div>
            </>
          )}
          <div className="pt-4 border-t border-border flex items-center gap-3"><Button onClick={save} disabled={saving || !loaded} className="bg-emerald-600 hover:bg-emerald-700">{saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</> : "Save Changes"}</Button>{!loaded && <span className="text-xs text-muted-foreground">Loading configuration…</span>}</div>
        </div>
      </div>
    </div>
  );
}