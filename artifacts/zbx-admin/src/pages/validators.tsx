import { useState } from "react";
import {
  useAdminListValidators, getAdminListValidatorsQueryKey,
  useAdminCreateValidator, useAdminUpdateValidator, useAdminDeleteValidator,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

type Status = "active" | "inactive" | "jailed" | "all";

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  inactive: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  jailed: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function Validators() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ moniker: "", address: "", website: "", description: "", commission: "5.00", status: "active" });

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
    setDialogOpen(true);
  }

  function openEdit(v: any) {
    setEditing(v);
    setForm({ moniker: v.moniker, address: v.address, website: v.website, description: v.description, commission: v.commission, status: v.status });
    setDialogOpen(true);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: getAdminListValidatorsQueryKey({}) });
  }

  function handleSave() {
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { moniker: form.moniker, status: form.status as any, commission: form.commission, website: form.website, description: form.description } }, {
        onSuccess: () => { toast({ title: "Validator updated" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      });
    } else {
      createMut.mutate({ data: { address: form.address, moniker: form.moniker, status: form.status as any, commission: form.commission, website: form.website, description: form.description } }, {
        onSuccess: () => { toast({ title: "Validator added" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Create failed", variant: "destructive" }),
      });
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Validator" : "Add Validator"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Input id="address" data-testid="input-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="zbx1val0x..." />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="moniker">Moniker</Label>
              <Input id="moniker" data-testid="input-moniker" value={form.moniker} onChange={e => setForm(f => ({ ...f, moniker: e.target.value }))} placeholder="Validator name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="commission">Commission %</Label>
                <Input id="commission" data-testid="input-commission" value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} placeholder="5.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
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
              <Input id="website" data-testid="input-website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" data-testid="input-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="About this validator" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-validator">
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Validator</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the validator from the registry.</AlertDialogDescription>
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
