import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useAuth } from "@/lib/AuthContext";
import { localClient } from "@/api/localDataClient";
import { Button } from "@/components/ui/button";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const isDemo = user?.provider === "demo";
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenu={() => setMobileOpen(true)} />
        {isDemo && <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-xs"><span><strong>DEMO MODE</strong> — Synthetic payment data</span><div className="flex gap-2"><Button variant="ghost" size="sm" className="h-7 text-xs text-amber-100 hover:text-white" onClick={() => { localClient.auth.resetDemo(); window.location.reload(); }}>Reset Demo Data</Button><Button variant="ghost" size="sm" className="h-7 text-xs text-amber-100 hover:text-white" onClick={() => logout()}>Sign In</Button></div></div>}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}