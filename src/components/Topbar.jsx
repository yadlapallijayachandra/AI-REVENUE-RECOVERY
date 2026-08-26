import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Sun, Moon, Bell, LogOut, User, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { localClient } from "@/api/localDataClient";

export default function Topbar({ onMenu, onSearch }) {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    localClient.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    try { await localClient.auth.logout(); } catch {}
    window.location.href = "/login";
  };

  return (
    <header className="h-16 sticky top-0 z-30 bg-background border-b border-border flex items-center gap-3 px-4 lg:px-6">
      <button className="lg:hidden p-2 rounded-lg hover:bg-accent" onClick={onMenu}><Menu className="w-5 h-5" /></button>
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          onChange={(e) => onSearch && onSearch(e.target.value)}
          placeholder="Search transactions, customers, recovery cases…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-muted/60 border border-transparent focus:border-border focus:bg-background outline-none transition-colors"
        />
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 rounded-lg hover:bg-accent" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button onClick={() => navigate("/notifications")} className="p-2 rounded-lg hover:bg-accent relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
        </button>
        <div className="relative" ref={ref}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover shadow-lg py-2">
              <div className="px-3 py-2 border-b border-border">
                <div className="text-sm font-medium truncate">{user?.full_name || "Merchant Admin"}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email || "merchant@recoverai.local"}</div>
              </div>
              <button onClick={() => { setMenuOpen(false); navigate("/settings"); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left">
                <User className="w-4 h-4" /> Settings
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left text-destructive">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}