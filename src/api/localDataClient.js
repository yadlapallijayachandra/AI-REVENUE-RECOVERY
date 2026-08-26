const STORAGE_PREFIX = "recoverai";
const API_BASE_URL = "/api";
const scopeKey = () => localStorage.getItem(`${STORAGE_PREFIX}:scope`) || "anonymous";
const entityKey = (name) => `${STORAGE_PREFIX}:${scopeKey()}:${name}`;

function read(name) {
  try { return JSON.parse(localStorage.getItem(entityKey(name)) || "[]"); } catch { return []; }
}

function write(name, rows) {
  localStorage.setItem(entityKey(name), JSON.stringify(rows));
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  const field = sort.replace(/^-/, "");
  const direction = sort.startsWith("-") ? -1 : 1;
  return rows.sort((a, b) => String(a[field] ?? "").localeCompare(String(b[field] ?? ""), undefined, { numeric: true }) * direction);
}

function makeEntity(name) {
  return {
    async list(sort, limit) { return sortRows(read(name), sort).slice(0, limit || undefined); },
    async get(id) { return read(name).find((row) => row.id === id) || null; },
    async filter(filters = {}, sort, limit) {
      const rows = read(name).filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
      return sortRows(rows, sort).slice(0, limit || undefined);
    },
    async create(data) {
      const row = { ...data, id: data.id || crypto.randomUUID(), created_date: data.created_date || new Date().toISOString(), updated_date: new Date().toISOString() };
      write(name, [...read(name), row]);
      return row;
    },
    async update(id, data) {
      const rows = read(name);
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) throw new Error(`${name} record not found`);
      rows[index] = { ...rows[index], ...data, updated_date: new Date().toISOString() };
      write(name, rows);
      return rows[index];
    },
    async delete(id) { write(name, read(name).filter((row) => row.id !== id)); },
    async bulkCreate(items) { for (const item of items) await this.create(item); },
    async bulkUpdate(items) { for (const item of items) await this.update(item.id, item); },
  };
}

export const localClient = {
  entities: new Proxy({}, { get: (_, name) => makeEntity(name) }),
  auth: {
    async request(path, options = {}) {
      let response;
      try {
        response = await fetch(`${API_BASE_URL}/auth${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
      } catch {
        throw Object.assign(new Error("RecoverAI authentication service is temporarily unavailable."), { code: "AUTH_SERVICE_UNAVAILABLE" });
      }
      const payload = response.status === 204 ? null : await response.json();
      if (!response.ok) {
        throw Object.assign(new Error(payload?.error || "Authentication request failed."), { code: payload?.code, status: response.status });
      }
      return payload;
    },
    async me() {
      if (localStorage.getItem(`${STORAGE_PREFIX}:demo`) === "true") return JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}:user`));
      const user = (await this.request("/me")).user;
      if (user?.workspace_id) localStorage.setItem(`${STORAGE_PREFIX}:scope`, user.workspace_id);
      localStorage.setItem(`${STORAGE_PREFIX}:user`, JSON.stringify(user));
      return user;
    },
    async logout() { localStorage.removeItem(`${STORAGE_PREFIX}:user`); localStorage.removeItem(`${STORAGE_PREFIX}:demo`); localStorage.removeItem(`${STORAGE_PREFIX}:scope`); await this.request("/logout", { method: "POST" }).catch(() => {}); },
    async loginViaEmailPassword(email, password) { const result = await this.request("/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem(`${STORAGE_PREFIX}:user`, JSON.stringify(result.user)); localStorage.setItem(`${STORAGE_PREFIX}:scope`, result.user.workspace_id); return result.user; },
    async register({ email, password, fullName }) { return this.request("/register", { method: "POST", body: JSON.stringify({ email, password, fullName }) }); },
    async resetPasswordRequest(email) { return this.request("/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); },
    async resetPassword({ resetToken, newPassword }) { return this.request("/reset-password", { method: "POST", body: JSON.stringify({ token: resetToken, password: newPassword }) }); },
    async verifyEmail(token) { return this.request(`/verify?token=${encodeURIComponent(token)}`); },
    async resendVerification(email) { return this.request("/resend-verification", { method: "POST", body: JSON.stringify({ email }) }); },
    enterDemo() { const user = { id: "demo-operator", email: "demo@recoverai.local", full_name: "Demo Operator", role: "operator", provider: "demo", workspace_id: "demo-workspace" }; localStorage.setItem(`${STORAGE_PREFIX}:user`, JSON.stringify(user)); localStorage.setItem(`${STORAGE_PREFIX}:demo`, "true"); localStorage.setItem(`${STORAGE_PREFIX}:scope`, user.workspace_id); return user; },
    resetDemo() { Object.keys(localStorage).filter((key) => key.startsWith(`${STORAGE_PREFIX}:demo-workspace:`)).forEach((key) => localStorage.removeItem(key)); },
    setToken() {},
    redirectToLogin() { window.location.assign("/login"); },
  },
};
