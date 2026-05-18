import { useState, useEffect, useCallback } from "react";
import { Zap, Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Flag {
  id: number; key: string; label: string; description: string | null;
  category: string; isEnabled: boolean; isPublic: boolean;
  createdAt: string; updatedAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  auth:     "bg-blue-500/15 text-blue-400 border-blue-500/30",
  features: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  defi:     "bg-green-500/15 text-green-400 border-green-500/30",
  ai:       "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  general:  "bg-muted text-muted-foreground border-border",
};

const DEFAULT_FLAGS = [
  { key: "signup_enabled",              label: "New Registrations",          description: "Allow new users to create accounts",           category: "auth",     isEnabled: true,  isPublic: true },
  { key: "invite_only",                 label: "Invite-Only Mode",           description: "Require an invite code to register",           category: "auth",     isEnabled: false, isPublic: true },
  { key: "email_verification_required", label: "Email Verification",         description: "Require email verification before login",      category: "auth",     isEnabled: false, isPublic: true },
  { key: "swap_enabled",                label: "Token Swap",                  description: "Enable swap feature in mobile app",            category: "defi",     isEnabled: true,  isPublic: true },
  { key: "staking_enabled",             label: "Staking",                     description: "Enable staking feature in mobile app",         category: "defi",     isEnabled: true,  isPublic: true },
  { key: "bridge_enabled",              label: "Cross-Chain Bridge",          description: "Enable bridge feature in mobile app",          category: "defi",     isEnabled: true,  isPublic: true },
  { key: "governance_enabled",          label: "Governance Voting",           description: "Enable governance voting in mobile app",       category: "features", isEnabled: true,  isPublic: true },
  { key: "ai_agent_enabled",            label: "AI Agent",                    description: "Enable AI agent chat in mobile app",           category: "ai",       isEnabled: true,  isPublic: true },
  { key: "analytics_enabled",           label: "Analytics Dashboard",         description: "Enable analytics charts in mobile app",        category: "features", isEnabled: true,  isPublic: true },
  { key: "leaderboard_enabled",         label: "Leaderboard",                 description: "Enable leaderboard in mobile app",             category: "features", isEnabled: true,  isPublic: true },
];

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ key: "", label: "", description: "", category: "general", isEnabled: true, isPublic: true });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/feature-flags`);
      const d = await r.json();
      setFlags(d.flags ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (flag: Flag) => {
    const r = await fetch(`${API}/admin/feature-flags/${flag.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !flag.isEnabled }),
    });
    const d = await r.json();
    if (!r.ok) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
    setFlags(f => f.map(x => x.id === flag.id ? { ...x, ...d } : x));

    // If this is an auth flag, also update system_settings
    if (["email_verification_required", "invite_only", "signup_enabled"].includes(flag.key)) {
      await fetch(`${API}/admin/settings/${flag.key}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: String(!flag.isEnabled) }),
      });
    }
    toast({ title: flag.isEnabled ? "Flag disabled" : "Flag enabled", description: flag.label });
  };

  const del = async (id: number) => {
    if (!confirm("Delete this feature flag?")) return;
    await fetch(`${API}/admin/feature-flags/${id}`, { method: "DELETE" });
    setFlags(f => f.filter(x => x.id !== id));
    toast({ title: "Deleted" });
  };

  const create = async () => {
    if (!newForm.key || !newForm.label) {
      toast({ title: "Error", description: "Key and label are required.", variant: "destructive" }); return;
    }
    const r = await fetch(`${API}/admin/feature-flags`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newForm),
    });
    const d = await r.json();
    if (!r.ok) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
    setFlags(f => [...f, d]);
    setShowNew(false);
    setNewForm({ key: "", label: "", description: "", category: "general", isEnabled: true, isPublic: true });
    toast({ title: "Flag created" });
  };

  const seedDefaults = async () => {
    let count = 0;
    for (const f of DEFAULT_FLAGS) {
      if (flags.find(x => x.key === f.key)) continue;
      const r = await fetch(`${API}/admin/feature-flags`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      if (r.ok) { const d = await r.json(); setFlags(prev => [...prev, d]); count++; }
    }
    toast({ title: `Seeded ${count} default flags` });
  };

  const grouped = flags.reduce((acc, f) => {
    const cat = f.category ?? "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {} as Record<string, Flag[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Feature Flags
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Enable or disable features across mobile app and dashboard</p>
        </div>
        <div className="flex gap-2">
          {flags.length === 0 && (
            <button onClick={seedDefaults}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-card border border-border/60 rounded-xl hover:bg-muted transition-colors">
              Seed Defaults
            </button>
          )}
          <button onClick={() => setShowNew(s => !s)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> New Flag
          </button>
        </div>
      </div>

      {/* New flag form */}
      {showNew && (
        <div className="bg-card border border-primary/30 rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-sm">Create Feature Flag</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Key (snake_case)</label>
              <input value={newForm.key} onChange={e => setNewForm(f => ({ ...f, key: e.target.value }))}
                placeholder="my_feature_flag"
                className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-sm font-mono outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Label</label>
              <input value={newForm.label} onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))}
                placeholder="My Feature Flag"
                className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-sm outline-none focus:border-primary/40" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Description</label>
              <input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of what this flag controls"
                className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-sm outline-none focus:border-primary/40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <select value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-sm outline-none">
                {["auth", "features", "defi", "ai", "general"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-4 items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newForm.isEnabled} onChange={e => setNewForm(f => ({ ...f, isEnabled: e.target.checked }))} />
                Enabled
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={newForm.isPublic} onChange={e => setNewForm(f => ({ ...f, isPublic: e.target.checked }))} />
                Public
              </label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm bg-muted rounded-xl hover:bg-muted/60">Cancel</button>
            <button onClick={create} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-xl hover:bg-primary/90">Create</button>
          </div>
        </div>
      )}

      {/* Flags grouped by category */}
      {Object.keys(grouped).length === 0 && !loading && (
        <div className="bg-card border border-border/60 rounded-2xl p-12 text-center">
          <Zap className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No feature flags yet. Click "Seed Defaults" to add the standard set.</p>
        </div>
      )}

      {Object.entries(grouped).map(([category, catFlags]) => (
        <div key={category} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border uppercase tracking-widest", CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general)}>
              {category}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {catFlags.map(flag => (
              <div key={flag.id} className={cn(
                "bg-card border rounded-2xl p-4 flex items-start gap-4 transition-all",
                flag.isEnabled ? "border-border/60" : "border-border/30 opacity-70"
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{flag.label}</p>
                    {!flag.isPublic && <Lock className="h-3 w-3 text-muted-foreground/50" />}
                    {flag.isPublic && <Globe className="h-3 w-3 text-muted-foreground/30" />}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{flag.key}</p>
                  {flag.description && <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggle(flag)} className="transition-colors">
                    {flag.isEnabled
                      ? <ToggleRight className="h-8 w-8 text-primary" />
                      : <ToggleLeft className="h-8 w-8 text-muted-foreground/40" />}
                  </button>
                  <button onClick={() => del(flag.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
