import { useState, useEffect, useCallback } from "react";
import {
  Users, Search, CheckCircle2, XCircle, Mail, MailCheck, Trash2,
  RefreshCw, Shield, UserX, UserCheck, Copy, ChevronLeft, ChevronRight, KeyRound
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AppUser {
  id: number; email: string; displayName: string | null;
  isActive: boolean; isEmailVerified: boolean; inviteCodeUsed: string | null;
  lastLoginAt: string | null; createdAt: string;
}

function Badge({ ok, labels }: { ok: boolean; labels: [string, string] }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
      ok ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-red-500/15 text-red-400 border-red-500/30")}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? labels[0] : labels[1]}
    </span>
  );
}

export default function AppUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AppUser | null>(null);
  const { toast } = useToast();
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), search: debouncedSearch });
      const r = await fetch(`${API}/admin/app-users?${params}`);
      const d = await r.json();
      setUsers(d.users ?? []);
      setTotal(d.total ?? 0);
    } finally { setLoading(false); }
  }, [page, debouncedSearch]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const patch = async (id: number, body: Record<string, unknown>) => {
    const r = await fetch(`${API}/admin/app-users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
    setUsers(u => u.map(x => x.id === id ? { ...x, ...d } : x));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...d } : null);
    toast({ title: "Updated", description: "User updated successfully." });
  };

  const del = async (id: number) => {
    if (!confirm("Delete this user permanently?")) return;
    const r = await fetch(`${API}/admin/app-users/${id}`, { method: "DELETE" });
    if (!r.ok) { toast({ title: "Error", description: "Delete failed.", variant: "destructive" }); return; }
    setUsers(u => u.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    toast({ title: "Deleted", description: "User removed." });
  };

  const revokeAll = async (id: number) => {
    await fetch(`${API}/admin/app-users/${id}/revoke-sessions`, { method: "POST" });
    toast({ title: "Sessions revoked", description: "All sessions for this user have been invalidated." });
  };

  const sendVerification = async (id: number) => {
    const r = await fetch(`${API}/admin/app-users/${id}/send-verification`, { method: "POST" });
    const d = await r.json();
    toast({ title: "Verification token generated", description: `Token: ${d.verificationToken}` });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> App Users
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage mobile app user accounts</p>
        </div>
        <button onClick={fetch_} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: total },
          { label: "Verified",    value: users.filter(u => u.isEmailVerified).length },
          { label: "Active",      value: users.filter(u => u.isActive).length },
          { label: "This Page",   value: users.length },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/60 rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by email or name…"
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border/60 rounded-xl text-sm outline-none focus:border-primary/40 transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">User</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Verified</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Active</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {users.length === 0 && !loading && (
                  <tr><td colSpan={4} className="text-center py-10 text-muted-foreground text-sm">No users found</td></tr>
                )}
                {users.map(u => (
                  <tr key={u.id}
                    onClick={() => setSelected(selected?.id === u.id ? null : u)}
                    className={cn("cursor-pointer hover:bg-muted/20 transition-colors",
                      selected?.id === u.id && "bg-primary/5 border-l-2 border-l-primary"
                    )}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{u.displayName ?? "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {u.isEmailVerified
                        ? <MailCheck className="h-4 w-4 text-green-400 mx-auto" />
                        : <Mail className="h-4 w-4 text-yellow-400 mx-auto" />}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {u.isActive
                        ? <CheckCircle2 className="h-4 w-4 text-green-400 mx-auto" />
                        : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total} total</p>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4 sticky top-0">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {(selected.displayName ?? selected.email).slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
              </div>
              <div>
                <p className="font-semibold">{selected.displayName ?? "No name"}</p>
                <p className="text-xs text-muted-foreground font-mono">{selected.email}</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email Verified</span>
                  <Badge ok={selected.isEmailVerified} labels={["Verified", "Unverified"]} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Status</span>
                  <Badge ok={selected.isActive} labels={["Active", "Disabled"]} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Login</span>
                  <span className="font-mono">{selected.lastLoginAt ? new Date(selected.lastLoginAt).toLocaleDateString() : "Never"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invite Code</span>
                  <span className="font-mono">{selected.inviteCodeUsed ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User ID</span>
                  <span className="font-mono">#{selected.id}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</p>
                <button
                  onClick={() => patch(selected.id, { isEmailVerified: !selected.isEmailVerified })}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-xl bg-muted/40 hover:bg-muted text-sm font-medium transition-colors"
                >
                  {selected.isEmailVerified
                    ? <><Mail className="h-4 w-4 text-yellow-400" /> Unverify Email</>
                    : <><MailCheck className="h-4 w-4 text-green-400" /> Mark Email Verified</>}
                </button>
                <button
                  onClick={() => patch(selected.id, { isActive: !selected.isActive })}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-xl bg-muted/40 hover:bg-muted text-sm font-medium transition-colors"
                >
                  {selected.isActive
                    ? <><UserX className="h-4 w-4 text-red-400" /> Deactivate Account</>
                    : <><UserCheck className="h-4 w-4 text-green-400" /> Activate Account</>}
                </button>
                <button
                  onClick={() => sendVerification(selected.id)}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-xl bg-muted/40 hover:bg-muted text-sm font-medium transition-colors"
                >
                  <KeyRound className="h-4 w-4 text-blue-400" /> Generate Verification Token
                </button>
                <button
                  onClick={() => revokeAll(selected.id)}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-xl bg-muted/40 hover:bg-muted text-sm font-medium transition-colors"
                >
                  <Shield className="h-4 w-4 text-orange-400" /> Revoke All Sessions
                </button>
                <button
                  onClick={() => del(selected.id)}
                  className="w-full flex items-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors"
                >
                  <Trash2 className="h-4 w-4" /> Delete User
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border/60 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
              <Users className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Click a user to view details and manage their account</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
