import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, LifeBuoy, Users, BarChart3, Sparkles, FlaskConical, SlidersHorizontal, Bell, ScrollText, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Transactions", path: "/transactions", icon: ArrowLeftRight },
  { label: "Recovery Queue", path: "/recovery", icon: LifeBuoy },
  { label: "Customers", path: "/customers", icon: Users },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
  { label: "AI Insights", path: "/ai-insights", icon: Sparkles },
  { label: "Simulator", path: "/simulator", icon: FlaskConical },
  { label: "Recovery Rules", path: "/rules", icon: SlidersHorizontal },
  { label: "Notifications", path: "/notifications", icon: Bell },
  { label: "Audit Logs", path: "/audit-logs", icon: ScrollText },
  { label: "Settings", path: "/settings", icon: Settings },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-16 flex items-center gap-2 px-6 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-heading font-bold text-foreground leading-none">RecoverAI</div>
            <div className="text-[10px] text-muted-foreground tracking-wide uppercase mt-1">Revenue Recovery</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV.map((item) => {
            const active = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="rounded-lg bg-sidebar-accent/50 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Demo Mode</div>
            Synthetic data. No real payments processed.
          </div>
        </div>
      </aside>
    </>
  );
}