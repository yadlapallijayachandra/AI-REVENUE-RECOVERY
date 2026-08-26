import { formatINR } from "./aiEngine";

export function formatMoney(n) {
  return "₹" + formatINR(n);
}

export function formatCompact(n) {
  const num = Number(n || 0);
  if (Math.abs(num) >= 10000000) return "₹" + (num / 10000000).toFixed(2) + "Cr";
  if (Math.abs(num) >= 100000) return "₹" + (num / 100000).toFixed(2) + "L";
  if (Math.abs(num) >= 1000) return "₹" + (num / 1000).toFixed(1) + "K";
  return "₹" + formatINR(num);
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(d) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return Math.max(1, Math.floor(diff / 60000)) + "m ago";
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}