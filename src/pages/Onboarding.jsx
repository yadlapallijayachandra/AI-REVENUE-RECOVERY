import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveSettings } from "@/lib/recovery";
import { Check, Building2, CreditCard, LifeBuoy, Bell, Sparkles, LayoutDashboard, ArrowRight, ArrowLeft } from "lucide-react";

const STEPS = [
  { k: "business", title: "Business Information", icon: Building2, desc: "Tell us about your business" },
  { k: "payment", title: "Payment Configuration", icon: CreditCard, desc: "Supported payment methods" },
  { k: "recovery", title: "Recovery Preferences", icon: LifeBuoy, desc: "Retry strategy defaults" },
  { k: "notification", title: "Notification Preferences", icon: Bell, desc: "How customers are notified" },
  { k: "strategy", title: "Recovery Strategy", icon: Sparkles, desc: "Choose your AI strategy" },
  { k: "intro", title: "Dashboard Introduction", icon: LayoutDashboard, desc: "You're all set" },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const [data, setData] = useState({ business_name: "", industry: "Fintech", methods: ["UPI", "Credit Card"], max_retries: 3, email: true, sms: false, strategy: "adaptive" });
  const [saving, setSaving] = useState(false);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const finish = async () => {
    setSaving(true);
    await saveSettings({
      business_name: data.business_name || "RecoverAI Demo Merchant",
      industry: data.industry,
      max_retries: Math.max(1, Math.min(5, data.max_retries)),
      auto_retry: data.strategy !== "customer_reminder",
      email_notifications: data.email,
      sms_notifications: data.sms,
      allowed_payment_methods: data.methods,
      recovery_strategy: data.strategy,
      onboarding_complete: true,
    });
    setSaving(false);
    navigate("/");
  };

  const S = STEPS[step];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div>
          <span className="font-bold text-lg">RecoverAI</span>
        </div>

        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.k} className="flex items-center gap-2 shrink-0">
              <div className={"w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors " + (i <= step ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground")}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={"w-8 h-0.5 " + (i < step ? "bg-emerald-600" : "bg-muted")} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center"><S.icon className="w-5 h-5 text-emerald-600" /></div>
            <div><h2 className="font-semibold text-lg">{S.title}</h2><p className="text-sm text-muted-foreground">{S.desc}</p></div>
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <div><Label>Business Name</Label><Input value={data.business_name} onChange={(e) => setData({ ...data, business_name: e.target.value })} placeholder="Acme Pvt Ltd" className="mt-1" /></div>
              <div><Label>Industry</Label><Select value={data.industry} onValueChange={(v) => setData({ ...data, industry: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Fintech">Fintech</SelectItem><SelectItem value="E-commerce">E-commerce</SelectItem><SelectItem value="SaaS">SaaS</SelectItem><SelectItem value="Education">Education</SelectItem></SelectContent></Select></div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-2">
              {["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"].map((m) => (
                <div key={m} className="flex items-center justify-between rounded-lg border border-border p-3"><span className="text-sm font-medium">{m}</span>
                  <Switch checked={data.methods.includes(m)} onCheckedChange={(v) => setData({ ...data, methods: v ? [...data.methods, m] : data.methods.filter((x) => x !== m) })} />
                </div>
              ))}
            </div>
          )}
          {step === 2 && (
            <div><Label>Maximum retries per transaction</Label><Input type="number" value={data.max_retries} onChange={(e) => setData({ ...data, max_retries: Number(e.target.value) })} className="mt-1" min={1} max={5} /><p className="text-xs text-muted-foreground mt-2">AI will schedule retries at optimal times within this limit.</p></div>
          )}
          {step === 3 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><div className="text-sm font-medium">Email</div><div className="text-xs text-muted-foreground">Send recovery reminders via email</div></div><Switch checked={data.email} onCheckedChange={(v) => setData({ ...data, email: v })} /></div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><div className="text-sm font-medium">SMS</div><div className="text-xs text-muted-foreground">Send recovery reminders via SMS</div></div><Switch checked={data.sms} onCheckedChange={(v) => setData({ ...data, sms: v })} /></div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-2">
              {[
                { v: "smart_retry", t: "Smart Retry", d: "Automatically retry at AI-determined optimal times" },
                { v: "customer_reminder", t: "Customer Reminder", d: "Notify customers to complete payment" },
                { v: "adaptive", t: "Adaptive Recovery", d: "AI chooses the best strategy per transaction" },
              ].map((o) => (
                <button key={o.v} onClick={() => setData({ ...data, strategy: o.v })} className={"w-full text-left rounded-lg border p-3 transition-colors " + (data.strategy === o.v ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30" : "border-border hover:bg-muted/40")}>
                  <div className="font-medium text-sm">{o.t}</div><div className="text-xs text-muted-foreground">{o.d}</div>
                </button>
              ))}
            </div>
          )}
          {step === 5 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8 text-emerald-600" /></div>
              <h3 className="font-semibold text-lg">You're all set!</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Your recovery platform is configured. Load demo data from the dashboard to start exploring.</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => navigate("/")}>Skip for now</Button>
            <div className="flex gap-2">
              {step > 0 && <Button variant="outline" onClick={prev}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>}
              {step < STEPS.length - 1 ? <Button onClick={next} className="bg-emerald-600 hover:bg-emerald-700">Continue <ArrowRight className="w-4 h-4 ml-1" /></Button>
                : <Button onClick={finish} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving ? "Saving…" : "Go to Dashboard"}</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}