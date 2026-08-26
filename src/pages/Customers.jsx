import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { formatCompact } from "@/lib/format";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    localClient.entities.Customer.list("-lifetime_value", 300).then((c) => { setCustomers(c || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.customer_id?.toLowerCase().includes(q);
  }), [customers, search]);

  if (loading) return <LoadingState />;
  return (
    <div>
      <PageHeader title="Customers" subtitle={filtered.length + " customers"} />
      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, ID…" className="pl-9" />
      </div>
      {filtered.length === 0 ? <EmptyState title="No customers found" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => navigate("/customers/" + c.id)} className="text-left rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold">{c.name.charAt(0)}</div>
                  <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.customer_id}</div></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/40 p-2"><div className="text-xs text-muted-foreground">LTV</div><div className="text-sm font-semibold">{formatCompact(c.lifetime_value)}</div></div>
                <div className="rounded-lg bg-muted/40 p-2"><div className="text-xs text-muted-foreground">Txns</div><div className="text-sm font-semibold">{c.total_transactions}</div></div>
                <div className="rounded-lg bg-muted/40 p-2"><div className="text-xs text-muted-foreground">Risk</div><div className="text-sm font-semibold"><StatusBadge status={c.risk_level} /></div></div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}