import { useState } from "react";
import {
  useAdminListUsers, getAdminListUsersQueryKey,
  useAdminCreateUser, useAdminUpdateUser, useAdminDeleteUser,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
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

const roleColor: Record<string, string> = {
  superadmin: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  moderator: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  viewer: "bg-muted text-muted-foreground",
};

export default function AdminUsers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "", role: "viewer", isActive: true });

  const { data, isLoading } = useAdminListUsers(
    { page, limit: 10 },
    { query: { queryKey: getAdminListUsersQueryKey({ page, limit: 10 }) } }
  );
  const createMut = useAdminCreateUser();
  const updateMut = useAdminUpdateUser();
  const deleteMut = useAdminDeleteUser();

  function openCreate() {
    setEditing(null);
    setForm({ username: "", email: "", password: "", displayName: "", role: "viewer", isActive: true });
    setDialogOpen(true);
  }

  function openEdit(u: any) {
    setEditing(u);
    setForm({ username: u.username, email: u.email, password: "", displayName: u.displayName, role: u.role, isActive: u.isActive });
    setDialogOpen(true);
  }

  function invalidate() { qc.invalidateQueries({ queryKey: getAdminListUsersQueryKey({}) }); }

  function handleSave() {
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { role: form.role as any, displayName: form.displayName, isActive: form.isActive } }, {
        onSuccess: () => { toast({ title: "User updated" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      });
    } else {
      createMut.mutate({ data: { username: form.username, email: form.email, password: form.password, role: form.role as any, displayName: form.displayName, isActive: form.isActive } }, {
        onSuccess: () => { toast({ title: "User created" }); setDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Create failed", variant: "destructive" }),
      });
    }
  }

  function handleDelete() {
    if (deleteId === null) return;
    deleteMut.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: "User removed" }); setDeleteId(null); invalidate(); },
      onError: () => toast({ title: "Delete failed", variant: "destructive" }),
    });
  }

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} panel users</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-user" size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">User</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Last Login</th>
                  <th className="text-center px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Active</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : data?.users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No admin users found</p>
                    </td>
                  </tr>
                ) : (
                  data?.users.map((u: any) => (
                    <tr key={u.id} data-testid={`row-user-${u.id}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{u.username.slice(0, 2).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{u.displayName || u.username}</p>
                            <p className="text-xs text-muted-foreground">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${roleColor[u.role] || ""}`}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`w-2 h-2 rounded-full mx-auto ${u.isActive ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)} data-testid={`button-edit-user-${u.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)} data-testid={`button-delete-user-${u.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Admin User" : "Create Admin User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input data-testid="input-username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="jsmith" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input data-testid="input-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jsmith@zbx.io" />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input data-testid="input-password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input data-testid="input-display-name" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="user-active" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} data-testid="switch-user-active" />
              <Label htmlFor="user-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} data-testid="button-save-user">{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin User</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this admin user.</AlertDialogDescription>
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
