import { useState, useEffect, useCallback } from "react";
import { Mail, Plus, Trash2, Copy, Check, RefreshCw, Link2, Clock, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Invite {
  id: number; code: string; email: string | null; note: string | null;
  isUsed: boolean; usedByUserId: number | null; expiresAt: string | null; createdAt: string;
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", note: "", expiresInDays: "" });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/invites`);
      const d = await r.json();
      setInvites(d.invites ?? []); setTotal(d.total ?? 0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const body: Record<string, unknown> = {};
    if (form.email.trim()) body.email = form.email.trim();
    if (form.note.trim())  body.note  = form.note.trim();
    if (form.expiresInDays) body.expiresInDays = Number(form.expiresInDays);

    const r = await fetch(`${API}/admin/invites`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
    setInvites(prev => [d, ...prev]);
    setTotal(t => t + 1);
    setShowNew(false);
    setForm({ email: "", note: "", expiresInDays: "" });
    toast({ title: "Invite created", description: `Code: ${d.code}` });
  };

  const del = async (id: number) => {
    if (!confirm("Revoke this invite?")) return;
    const r = await fetch(`${API}/admin/invites/${id}`, { method: "DELETE" });
    if (!r.ok) return;
    setInvites(i => i.filter(x => x.id !== id));
    toast({ title: "Invite revoked" });
  };

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
    toast({ title: "Copied", description: `Invite code ${code} copied.` });
  };

  const unused = invites.filter(i => !i.isUsed);
  const used   = invites.filter(i => i.isUsed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" /> Invite Codes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage signup invite codes for the mobile app</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button onClick={() => setShowNew(s => !s)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Create Invite
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Invites", value: total },
          { label: "Available",     value: unused.length },
          { label: "Used",          value: used.length },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/60 rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showNew && (
        <div className="bg-card border border-primary/30 rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-sm">Create Invite Code</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Email (optional — restrict to specific email)</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
                className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-sm outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Expires in (days)</label>
              <input type="number" value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))}
                placeholder="7"
                className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-sm outline-none focus:border-primary/40" />
            </div>
            <div className="col-span-3">
              <label className="text-xs text-muted-foreground">Note (internal)</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="e.g. For beta tester John"
                className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-sm outline-none focus:border-primary/40" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm bg-muted rounded-xl hover:bg-muted/60">Cancel</button>
            <button onClick={create} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">Create</button>
          </div>
        </div>
      )}

      {/* Unused invites */}
      {unused.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Available ({unused.length})</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {unused.map(invite => (
              <div key={invite.id} className="bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-mono tracking-widest text-primary">{invite.code}</span>
                    <button onClick={() => copy(invite.code)} className="text-muted-foreground/50 hover:text-primary transition-colors">
                      {copied === invite.code ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {invite.email && <p className="text-xs text-muted-foreground mt-0.5"><Mail className="h-3 w-3 inline mr-1" />{invite.email}</p>}
                  {invite.note && <p className="text-xs text-muted-foreground mt-0.5 italic">{invite.note}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(invite.createdAt).toLocaleDateString()}
                    {invite.expiresAt && <span className="ml-2 text-yellow-400"><Clock className="h-3 w-3 inline mr-0.5" />Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>}
                  </p>
                </div>
                <button onClick={() => del(invite.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Used invites */}
      {used.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Used ({used.length})</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {used.map(invite => (
              <div key={invite.id} className="bg-card border border-border/30 rounded-2xl p-4 flex items-center gap-4 opacity-60">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-mono tracking-widest text-muted-foreground line-through">{invite.code}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Used
                    </span>
                  </div>
                  {invite.email && <p className="text-xs text-muted-foreground mt-0.5">{invite.email}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Used on {new Date(invite.createdAt).toLocaleDateString()} · User #{invite.usedByUserId}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {invites.length === 0 && !loading && (
        <div className="bg-card border border-border/60 rounded-2xl p-12 text-center">
          <Link2 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No invite codes yet. Create one to invite users.</p>
        </div>
      )}
    </div>
  );
}
