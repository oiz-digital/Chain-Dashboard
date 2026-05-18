import { useState } from "react";
import {
  useAdminListValidators, getAdminListValidatorsQueryKey,
  useAdminCreateValidator, useAdminUpdateValidator, useAdminDeleteValidator,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Shield, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { StepProgress, Step } from "@/components/ui/step-progress";
import { StatusBanner } from "@/components/ui/status-banner";
import { cn } from "@/lib/utils";

type Status = "active" | "inactive" | "jailed" | "all";

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  inactive: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  jailed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STEPS: Step[] = [
  { label: "Details", description: "Fill info" },
  { label: "Saving", description: "Sending" },
  { label: "Done", description: "Saved" },
];

export default function Validators() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ moniker: "", address: "", website: "", description: "", commission: "5.00", status: "active" });
  const [step, setStep] = useState(0);
  const [saveError, setSaveError] = useState("");

  const { data, isLoading } = useAdminListValidators(
    { page, limit: 10, ...(statusFilter !== "all" ? { status: statusFilter } : {}) },
    { query: { queryKey: getAdminListValidatorsQueryKey({ page, limit: 10, ...(statusFilter !== "all" ? { status: statusFilter } : {}) }) } }
  );
  const createMut = useAdminCreateValidator();
  const updateMut = useAdminUpdateValidator();
  const deleteMut = useAdminDeleteValidator();

  function openCreate() {
    setEditing(null);
    setForm({ moniker: "", address: "", website: "", description: "", commission: "5.00", status: "active" });
    setStep(0); setSaveError("");
    setDialogOpen(true);
  }

  function openEdit(v: any) {
    setEditing(v);
    setForm({ moniker: v.moniker, address: v.address, website: v.website ?? "", description: v.description ?? "", commission: v.commission, status: v.status });
    setStep(0); setSaveError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    if (step === 1) return;
    setDialogOpen(false);
    setTimeout(() => { setStep(0); setSaveError(""); }, 300);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: getAdminListValidatorsQueryKey({}) });
  }

  function handleSave() {
    setSaveError("");
    setStep(1);

    const onSuccess = () => {
      setStep(2);
      invalidate();
      toast({ title: editing ? "Validator updated" : "Validator added" });
      setTimeout(() => { setDialogOpen(false); setTimeout(() => setStep(0), 300); }, 1000);
    };
    const onError = () => {
      setStep(0);
      setSaveError("Save failed. Please check your inputs and try again.");
      toast({ title: "Save failed", variant: "destructive" });
    };

    if (editing) {
      updateMut.mutate({ id: editing.id, data: { moniker: form.moniker, status: form.status as any, commission: form.commission, website: form.website, description: form.description } }, { onSuccess, onError });
    } else {
      createMut.mutate({ data: { address: form.address, moniker: form.moniker, status: form.status as any, commission: form.commission, website: form.website, description: form.description } }, { onSuccess, onError });
    }
  }

  function handleDelete() {
    if (deleteId === null) return;
    deleteMut.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: "Validator removed" }); setDeleteId(null); invalidate(); },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    });
  }

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Validators</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} validators total</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as Status); setPage(1); }}>
            <SelectTrigger className="w-36" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="jailed">Jailed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate} data-testid="button-add-validator" size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add Validator
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Rank</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Moniker</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Commission</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Staked</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Delegators</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium w-32">Uptime</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : data?.validators.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No validators found</p>
                    </td>
                  </tr>
                ) : (
                  data?.validators.map((v: any) => (
                    <tr key={v.id} data-testid={`row-validator-${v.id}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted-foreground text-xs">#{v.rank || "—"}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{v.moniker}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">{v.address}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${statusColor[v.status] || ""}`}>{v.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{v.commission}%</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground text-xs">{Number(v.totalStaked).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{v.delegators}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={Number(v.uptime)} className="h-1.5 flex-1" />
                          <span className="text-xs font-mono text-muted-foreground w-12 text-right">{Number(v.uptime).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)} data-testid={`button-edit-validator-${v.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(v.id)} data-testid={`button-delete-validator-${v.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page">Prev</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} data-testid="button-next-page">Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Validator" : "Add Validator"}</DialogTitle>
          </DialogHeader>

          {/* Step progress */}
          <StepProgress steps={STEPS} currentStep={step} status={saveError ? "error" : "active"} className="py-2" />

          {saveError && <StatusBanner type="error" title="Save failed" message={saveError} className="mt-1" />}

          {step === 2 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="font-medium text-foreground">Validator {editing ? "updated" : "created"} successfully!</p>
              <p className="text-xs text-muted-foreground">Closing automatically...</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                {!editing && (
                  <div className="space-y-1.5">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" data-testid="input-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="zbx1val0x..." disabled={step === 1} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="moniker">Moniker</Label>
                  <Input id="moniker" data-testid="input-moniker" value={form.moniker} onChange={e => setForm(f => ({ ...f, moniker: e.target.value }))} placeholder="Validator name" disabled={step === 1} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="commission">Commission %</Label>
                    <Input id="commission" data-testid="input-commission" value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} placeholder="5.00" disabled={step === 1} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} disabled={step === 1}>
                      <SelectTrigger data-testid="select-validator-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="jailed">Jailed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" data-testid="input-website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." disabled={step === 1} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" data-testid="input-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="About this validator" disabled={step === 1} />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={closeDialog} disabled={step === 1}>Cancel</Button>
                <Button onClick={handleSave} disabled={step === 1} data-testid="button-save-validator">
                  {step === 1 ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...</> : editing ? "Update" : "Create"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Validator</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the validator from the registry. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <StatusBanner type="warning" title="Irreversible action" message="All validator data and delegation history will be lost." dismissible={false} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Removing...</> : "Remove Validator"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
