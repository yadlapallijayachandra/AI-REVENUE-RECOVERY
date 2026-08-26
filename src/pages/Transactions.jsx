import { useEffect, useState, useMemo } from "react";
import { localClient } from "@/api/localDataClient";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ProbabilityBadge from "@/components/ProbabilityBadge";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import TransactionDetailDrawer from "@/components/TransactionDetailDrawer";
import { formatMoney, formatDateTime } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const METHODS = ["ALL", "UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"];
const STATUSES = ["ALL", "SUCCESS", "FAILED", "PENDING", "PROCESSING", "RECOVERY_PENDING", "RECOVERY_ATTEMPTED", "RECOVERED", "PERMANENTLY_FAILED"];
const PAGE_SIZE = 12;

export default function Transactions() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setAll(await localClient.entities.Transaction.list("-created_date", 1000)); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return all.filter((t) => {
      if (method !== "ALL" && t.payment_method !== method) return false;
      if (status !== "ALL" && t.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.transaction_id?.toLowerCase().includes(q) && !t.customer_name?.toLowerCase().includes(q) && !t.customer_email?.toLowerCase().includes(q) && !t.order_id?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [all, search, method, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const headers = ["transaction_id", "customer_name", "amount", "payment_method", "status", "failure_reason", "recovery_probability", "created_date"];
    const rows = filtered.map((t) => headers.map((h) => `"${(t[h] ?? "").toString().replace(/"/g, "")}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "transactions.csv"; a.click();
    logAudit("export", "Transaction", "Exported " + filtered.length + " transactions");
  };

  if (loading) return <LoadingState />;
  return (
    <div>
      <PageHeader title="Transactions" subtitle={filtered.length + " of " + all.length + " transactions"}>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> Export</Button>
      </PageHeader>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search ID, customer, email…" className="pl-9" />
        </div>
        <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m === "ALL" ? "All methods" : m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {pageItems.length === 0 ? (
        <EmptyState title="No transactions match your filters" description="Try adjusting search or filters." />
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Transaction</th>
                  <th className="text-left font-medium px-4 py-3">Customer</th>
                  <th className="text-right font-medium px-4 py-3">Amount</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Method</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Failure</th>
                  <th className="text-left font-medium px-4 py-3">Recovery</th>
                  <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItems.map((t) => (
                  <tr key={t.id} onClick={() => setSelected(t)} className="cursor-pointer hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{t.transaction_id}</td>
                    <td className="px-4 py-3"><div className="font-medium">{t.customer_name}</div><div className="text-xs text-muted-foreground">{t.customer_email}</div></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(t.amount)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{t.payment_method}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{t.failure_reason || "—"}</td>
                    <td className="px-4 py-3">{t.failure_reason ? <ProbabilityBadge value={t.recovery_probability} /> : <span className="text-muted-foreground text-xs">—</span>}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{formatDateTime(t.created_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      {selected && <TransactionDetailDrawer transaction={selected} onClose={() => { setSelected(null); load(); }} />}
    </div>
  );
}