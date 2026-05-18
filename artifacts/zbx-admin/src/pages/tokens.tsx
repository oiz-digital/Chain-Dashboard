import { useState } from "react";
import {
  useAdminListTokens, getAdminListTokensQueryKey,
  useAdminCreateToken, useAdminUpdateToken, useAdminDeleteToken,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Coins, CheckCircle, XCircle } from "lucide-react";
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

const typeColor: Record<string, string> = {
  native: "bg-primary/15 text-primary border-primary/30",
  erc20: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  lp: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  wrapped: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function Tokens() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    symbol: "", name: "", type: "erc20", contractAddress: "", decimals: "18",
    totalSupply: "0", circulatingSupply: "0", priceUsd: "0", marketCap: "0",
    volume24h: "0", holders: "0", description: "", website: "", isActive: true, isVerified: false,
  });

  const { data, isLoading } = useAdminListTokens(
    { page, limit: 10 },
    { query: { queryKey: getAdminListTokensQueryKey({ page, limit: 10 }) } }
  );
  const createMut = useAdminCreateToken();
  const updateMut = useAdminUpdateToken();
  const deleteMut = useAdminDeleteToken();

  function openCreate() {
    setEditing(null);
    setForm({ symbol: "", name: "", type: "erc20", contractAddress: "", decimals: "18", totalSupply: "0", circulatingSupply: "0", priceUsd: "0", marketCap: "0", volume24h: "0", holders: "0", description: "", website: "", isActive: true, isVerified: false });
    setDialogOpen(true);
  }

  function openEdit(t: any) {
    setEditing(t);
    setForm({ symbol: t.symbol, name: t.name, type: t.type, contractAddress: t.contractAddress ?? "", decimals: String(t.decimals), totalSupply: t.totalSupply, circulatingSupply: t.circulatingSupply, priceUsd: t.priceUsd, marketCap: t.marketCap, volume24h: t.volume24h, holders: String(t.holders), description: t.description, website: t.website, isActive: t.isActive, isVerified: t.isVerified });
    setDialogOpen(true);
  }

  function invalidate() { qc.invalidateQueries({ queryKey: getAdminListTokensQueryKey({}) }); }

  function handleSave() {
    const payload = {
      symbol: form.symbol, name: form.name, type: form.type as any,
      contractAddress: form.contractAddress || undefined,
      decimals: Number(form.decimals), totalSupply: form.totalSupply,
      circulatingSupply: form.circulatingSupply, priceUsd: form.priceUsd,
      marketCap: form.marketCap, volume24h: form.volume24h, holders: Number(form.holders),
      description: form.description, website: form.website,
      isActive: form.isActive, isVerified: form.isVerified,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => { toast({ title: "Token updated" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      });
    } else {
      createMut.mutate({ data: payload }, {
        onSuccess: () => { toast({ title: "Token added" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Create failed", variant: "destructive" }),
      });
    }
  }

  function handleDelete() {
    if (deleteId === null) return;
    deleteMut.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: "Token removed" }); setDeleteId(null); invalidate(); },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    });
  }

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Token Registry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} tokens registered</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-token" size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Token
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Token</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Type</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Price (USD)</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Market Cap</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">24h Vol</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Holders</th>
                  <th className="text-center px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : data?.tokens.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Coins className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No tokens registered</p>
                    </td>
                  </tr>
                ) : (
                  data?.tokens.map((t: any) => (
                    <tr key={t.id} data-testid={`row-token-${t.id}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground">{t.symbol}</p>
                            {t.isVerified && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <p className="text-xs text-muted-foreground">{t.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${typeColor[t.type] || ""}`}>{t.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">${Number(t.priceUsd).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground text-xs">${Number(t.marketCap).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground text-xs">${Number(t.volume24h).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">{Number(t.holders).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {t.isActive ? <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} data-testid={`button-edit-token-${t.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)} data-testid={`button-delete-token-${t.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
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
            <DialogTitle>{editing ? "Edit Token" : "Add Token"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Symbol</Label>
                <Input data-testid="input-symbol" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="ZBX" disabled={!!editing} />
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input data-testid="input-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Zebvix Chain" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-token-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="native">Native</SelectItem>
                    <SelectItem value="erc20">ERC-20</SelectItem>
                    <SelectItem value="lp">LP</SelectItem>
                    <SelectItem value="wrapped">Wrapped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Decimals</Label>
                <Input data-testid="input-decimals" value={form.decimals} onChange={e => setForm(f => ({ ...f, decimals: e.target.value }))} placeholder="18" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contract Address</Label>
              <Input data-testid="input-contract" value={form.contractAddress} onChange={e => setForm(f => ({ ...f, contractAddress: e.target.value }))} placeholder="0x..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Price (USD)</Label>
                <Input data-testid="input-price" value={form.priceUsd} onChange={e => setForm(f => ({ ...f, priceUsd: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Market Cap</Label>
                <Input data-testid="input-marketcap" value={form.marketCap} onChange={e => setForm(f => ({ ...f, marketCap: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input data-testid="input-website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch id="active" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} data-testid="switch-active" />
                <Label htmlFor="active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="verified" checked={form.isVerified} onCheckedChange={v => setForm(f => ({ ...f, isVerified: v }))} data-testid="switch-verified" />
                <Label htmlFor="verified">Verified</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-token">{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Token</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the token from the registry.</AlertDialogDescription>
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
