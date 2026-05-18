import { useState } from "react";
import {
  useAdminListSettings, getAdminListSettingsQueryKey,
  useAdminUpdateSetting,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, Settings, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

  const { data: settings, isLoading } = useAdminListSettings({
    query: { queryKey: getAdminListSettingsQueryKey() }
  });
  const updateMut = useAdminUpdateSetting();

  function handleEdit(key: string, val: string) {
    setEditing(e => ({ ...e, [key]: val }));
  }

  function handleSave(key: string) {
    const value = editing[key];
    if (value === undefined) return;
    setSaving(s => ({ ...s, [key]: true }));
    updateMut.mutate({ key, data: { value } }, {
      onSuccess: () => {
        toast({ title: `Setting "${key}" updated` });
        setEditing(e => { const n = { ...e }; delete n[key]; return n; });
        qc.invalidateQueries({ queryKey: getAdminListSettingsQueryKey() });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
      onSettled: () => setSaving(s => ({ ...s, [key]: false })),
    });
  }

  const grouped = settings ? groupBy(settings, "category") : {};
  const categories = Object.keys(grouped).sort();

  const catIcon: Record<string, React.ComponentType<{ className?: string }>> = {
    chain: Globe,
    staking: Settings,
    ai: Settings,
    general: Settings,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure core chain and protocol parameters</p>
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
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {grouped[cat].map((s: any) => {
                    const isDirty = editing[s.key] !== undefined;
                    const currentVal = isDirty ? editing[s.key] : s.value;
                    return (
                      <div key={s.key} data-testid={`setting-row-${s.key}`} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/10">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-foreground">{s.label}</p>
                            <Badge variant="outline" className="text-xs h-4 px-1 font-mono bg-muted/30">{s.type}</Badge>
                            {s.isPublic
                              ? <Globe className="w-3 h-3 text-cyan-400" />
                              : <Lock className="w-3 h-3 text-muted-foreground/50" />
                            }
                          </div>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                          <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">key: {s.key}</p>
                        </div>
                        <div className="flex items-center gap-2 w-52">
                          <Input
                            data-testid={`input-setting-${s.key}`}
                            value={currentVal}
                            onChange={e => handleEdit(s.key, e.target.value)}
                            className={`h-8 text-xs font-mono ${isDirty ? "border-primary/60 ring-1 ring-primary/20" : ""}`}
                          />
                          {isDirty && (
                            <Button
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => handleSave(s.key)}
                              disabled={saving[s.key]}
                              data-testid={`button-save-setting-${s.key}`}
                            >
                              <Save className="w-3.5 h-3.5" />
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
