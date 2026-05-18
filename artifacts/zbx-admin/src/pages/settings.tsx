import { useState } from "react";
import {
  useAdminListSettings, getAdminListSettingsQueryKey,
  useAdminUpdateSetting,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Settings, Globe, Lock, Loader2, CheckCircle2, Brain, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { StatusBanner } from "@/components/ui/status-banner";

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export default function SystemSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const { data: settings, isLoading } = useAdminListSettings({
    query: { queryKey: getAdminListSettingsQueryKey() }
  });
  const updateMut = useAdminUpdateSetting();

  function handleEdit(key: string, val: string) {
    setEditing(e => ({ ...e, [key]: val }));
    setSaved(s => { const n = { ...s }; delete n[key]; return n; });
  }

  function handleSave(key: string) {
    const value = editing[key];
    if (value === undefined) return;
    setSaving(s => ({ ...s, [key]: true }));
    updateMut.mutate({ key, data: { value } }, {
      onSuccess: () => {
        toast({ title: `Setting updated`, description: `"${key}" saved successfully.` });
        setEditing(e => { const n = { ...e }; delete n[key]; return n; });
        setSaved(s => ({ ...s, [key]: true }));
        qc.invalidateQueries({ queryKey: getAdminListSettingsQueryKey() });
        setTimeout(() => setSaved(s => { const n = { ...s }; delete n[key]; return n; }), 2000);
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
      onSettled: () => setSaving(s => ({ ...s, [key]: false })),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent, key: string) {
    if (e.key === "Enter") handleSave(key);
    if (e.key === "Escape") setEditing(ed => { const n = { ...ed }; delete n[key]; return n; });
  }

  const grouped = settings ? groupBy(settings, "category") : {};
  const categories = Object.keys(grouped).sort();

  const catIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    chain: Globe,
    staking: Cpu,
    ai: Brain,
    general: Settings,
  };

  const dirtyCount = Object.keys(editing).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure core chain and protocol parameters</p>
        </div>
        {dirtyCount > 0 && (
          <StatusBanner
            type="warning"
            title={`${dirtyCount} unsaved change${dirtyCount > 1 ? "s" : ""}`}
            message="Click the save button next to each field to apply."
            dismissible={false}
          />
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No settings found</p>
          </CardContent>
        </Card>
      ) : (
        categories.map(cat => {
          const Icon = catIcon[cat] || Settings;
          return (
            <Card key={cat}>
              <CardHeader className="pb-2 border-b border-border">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2 capitalize">
                  <Icon className="w-4 h-4 text-primary" />
                  {cat}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{grouped[cat].length} setting{grouped[cat].length !== 1 ? "s" : ""}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {grouped[cat].map((s: any) => {
                    const isDirty = editing[s.key] !== undefined;
                    const isSaving = saving[s.key];
                    const isSaved = saved[s.key];
                    const currentVal = isDirty ? editing[s.key] : s.value;
                    return (
                      <div key={s.key} data-testid={`setting-row-${s.key}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/10 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-foreground">{s.label}</p>
                            <Badge variant="outline" className="text-xs h-4 px-1 font-mono bg-muted/30">{s.type}</Badge>
                            {s.isPublic
                              ? <Globe className="w-3 h-3 text-cyan-400" title="Public setting" />
                              : <Lock className="w-3 h-3 text-muted-foreground/50" title="Private setting" />
                            }
                          </div>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                          <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">key: {s.key}</p>
                        </div>
                        <div className="flex items-center gap-2 w-56">
                          <Input
                            data-testid={`input-setting-${s.key}`}
                            value={currentVal}
                            onChange={e => handleEdit(s.key, e.target.value)}
                            onKeyDown={e => handleKeyDown(e, s.key)}
                            className={`h-8 text-xs font-mono transition-all ${
                              isDirty ? "border-amber-500/60 ring-1 ring-amber-500/20" :
                              isSaved ? "border-emerald-500/60 ring-1 ring-emerald-500/20" : ""
                            }`}
                          />
                          {isSaved && !isDirty && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          )}
                          {isDirty && (
                            <Button
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => handleSave(s.key)}
                              disabled={isSaving}
                              data-testid={`button-save-setting-${s.key}`}
                              title="Save (Enter)"
                            >
                              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
