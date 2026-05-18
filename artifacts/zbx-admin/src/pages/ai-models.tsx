import { useState } from "react";
import {
  useAdminListAiModels, getAdminListAiModelsQueryKey,
  useAdminCreateAiModel, useAdminUpdateAiModel, useAdminDeleteAiModel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Brain, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const catColor: Record<string, string> = {
  nlp: "bg-primary/15 text-primary border-primary/30",
  security: "bg-red-500/15 text-red-400 border-red-500/30",
  oracle: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  vision: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  audio: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  multimodal: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
};

const quantColor: Record<string, string> = {
  INT4: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  INT8: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  FP16: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  FP32: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export default function AiModels() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    modelIndex: "", name: "", category: "nlp", quantization: "INT8",
    paramsBillion: "1.00", gasPerCall: "6000", latencyMs: "500",
    accuracyPct: "90.00", description: "", publisherAddress: "",
    publisherRevenuePct: "60", daoRevenuePct: "25", validatorRevenuePct: "15", isActive: true,
  });

  const { data, isLoading } = useAdminListAiModels(
    { page, limit: 10 },
    { query: { queryKey: getAdminListAiModelsQueryKey({ page, limit: 10 }) } }
  );
  const createMut = useAdminCreateAiModel();
  const updateMut = useAdminUpdateAiModel();
  const deleteMut = useAdminDeleteAiModel();

  function openCreate() {
    setEditing(null);
    setForm({ modelIndex: "", name: "", category: "nlp", quantization: "INT8", paramsBillion: "1.00", gasPerCall: "6000", latencyMs: "500", accuracyPct: "90.00", description: "", publisherAddress: "", publisherRevenuePct: "60", daoRevenuePct: "25", validatorRevenuePct: "15", isActive: true });
    setDialogOpen(true);
  }

  function openEdit(m: any) {
    setEditing(m);
    setForm({ modelIndex: String(m.modelIndex), name: m.name, category: m.category, quantization: m.quantization, paramsBillion: m.paramsBillion, gasPerCall: String(m.gasPerCall), latencyMs: String(m.latencyMs), accuracyPct: m.accuracyPct, description: m.description, publisherAddress: m.publisherAddress, publisherRevenuePct: String(m.publisherRevenuePct), daoRevenuePct: String(m.daoRevenuePct), validatorRevenuePct: String(m.validatorRevenuePct), isActive: m.isActive });
    setDialogOpen(true);
  }

  function invalidate() { qc.invalidateQueries({ queryKey: getAdminListAiModelsQueryKey({}) }); }

  function handleSave() {
    const payload = {
      modelIndex: Number(form.modelIndex), name: form.name, category: form.category as any,
      quantization: form.quantization as any, paramsBillion: form.paramsBillion,
      gasPerCall: Number(form.gasPerCall), latencyMs: Number(form.latencyMs),
      accuracyPct: form.accuracyPct, description: form.description,
      publisherAddress: form.publisherAddress, publisherRevenuePct: Number(form.publisherRevenuePct),
      daoRevenuePct: Number(form.daoRevenuePct), validatorRevenuePct: Number(form.validatorRevenuePct),
      isActive: form.isActive,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { toast({ title: "Model updated" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      });
    } else {
      createMut.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Model registered" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Create failed", variant: "destructive" }),
      });
    }
  }

  function handleDelete() {
    if (deleteId === null) return;
    deleteMut.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: "Model removed" }); setDeleteId(null); invalidate(); },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    });
  }

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Model Registry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} on-chain models</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-model" size="sm">
          <Plus className="w-4 h-4 mr-1" /> Register Model
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Model</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Quant</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Params (B)</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Gas/Call</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Latency</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Accuracy</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Calls</th>
                  <th className="text-center px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Active</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : data?.models.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No AI models registered</p>
                    </td>
                  </tr>
                ) : (
                  data?.models.map((m: any) => (
                    <tr key={m.id} data-testid={`row-model-${m.id}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground font-mono text-xs">{m.name}</p>
                          <p className="text-xs text-muted-foreground">ZEP-{String(m.modelIndex).padStart(3, "0")}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${catColor[m.category] || ""}`}>{m.category}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${quantColor[m.quantization] || ""}`}>{m.quantization}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{m.paramsBillion}B</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground text-xs">{Number(m.gasPerCall).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground text-xs">{m.latencyMs}ms</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{Number(m.accuracyPct).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground text-xs">{Number(m.totalCalls).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <div className={`w-2 h-2 rounded-full mx-auto ${m.isActive ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)} data-testid={`button-edit-model-${m.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(m.id)} data-testid={`button-delete-model-${m.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit AI Model" : "Register AI Model"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Model Index</Label>
                <Input data-testid="input-model-index" value={form.modelIndex} onChange={e => setForm(f => ({ ...f, modelIndex: e.target.value }))} placeholder="6" disabled={!!editing} />
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input data-testid="input-model-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ZEP-NLP-7B" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["nlp", "security", "oracle", "vision", "audio", "multimodal"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantization</Label>
                <Select value={form.quantization} onValueChange={v => setForm(f => ({ ...f, quantization: v }))}>
                  <SelectTrigger data-testid="select-quantization"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["INT4", "INT8", "FP16", "FP32"].map(q => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Params (B)</Label>
                <Input data-testid="input-params" value={form.paramsBillion} onChange={e => setForm(f => ({ ...f, paramsBillion: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Gas/Call</Label>
                <Input data-testid="input-gas" value={form.gasPerCall} onChange={e => setForm(f => ({ ...f, gasPerCall: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Latency (ms)</Label>
                <Input data-testid="input-latency" value={form.latencyMs} onChange={e => setForm(f => ({ ...f, latencyMs: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Publisher Address</Label>
              <Input data-testid="input-publisher" value={form.publisherAddress} onChange={e => setForm(f => ({ ...f, publisherAddress: e.target.value }))} placeholder="zbx1pub0x..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Publisher %</Label>
                <Input data-testid="input-pub-pct" value={form.publisherRevenuePct} onChange={e => setForm(f => ({ ...f, publisherRevenuePct: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>DAO %</Label>
                <Input data-testid="input-dao-pct" value={form.daoRevenuePct} onChange={e => setForm(f => ({ ...f, daoRevenuePct: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Validator %</Label>
                <Input data-testid="input-val-pct" value={form.validatorRevenuePct} onChange={e => setForm(f => ({ ...f, validatorRevenuePct: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="model-active" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} data-testid="switch-model-active" />
              <Label htmlFor="model-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-model">{editing ? "Update" : "Register"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove AI Model</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the model from the registry.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
