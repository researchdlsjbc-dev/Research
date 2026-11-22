import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { UserPlus, Pencil, Trash2, Users } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'user' });

  const fetchUsers = () => axios.get(`${API}/users/`).then(r => { if (Array.isArray(r.data)) setUsers(r.data); }).catch(() => {});
  useEffect(() => { fetchUsers(); }, []);

  const openNew = () => { setEditing(null); setForm({ username: '', password: '', full_name: '', role: 'user' }); setShowModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const data = { full_name: form.full_name, role: form.role };
        if (form.password) data.password = form.password;
        await axios.put(`${API}/users/${editing.id}`, data);
      } else {
        await axios.post(`${API}/users/`, form);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await axios.delete(`${API}/users/${id}`);
    fetchUsers();
  };

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="admin-eyebrow">
            <Users className="h-3 w-3" />
            People
          </span>
          <h1 className="admin-title mt-3">Manage <em>Users</em></h1>
          <p className="admin-subtitle">Add, edit, or remove system users</p>
        </div>
        <Button className="gradient-btn rounded-full" onClick={openNew}><UserPlus className="h-4 w-4" /> Add User</Button>
      </div>

      <div className="admin-panel overflow-hidden">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title"><Users className="h-4 w-4 text-emerald-brand" /> All Users</h2>
          <span className="text-[13px] font-semibold text-muted-green">{users.length} {users.length === 1 ? 'account' : 'accounts'}</span>
        </div>
        <div className="table-scroll">
        <Table className="admin-table min-w-[720px]">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead>ID</TableHead><TableHead>Username</TableHead><TableHead>Full Name</TableHead><TableHead>Role</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id} className="border-0">
                <TableCell className="font-mono text-muted-green">{u.id}</TableCell>
                <TableCell className="font-semibold text-forest">{u.username}</TableCell>
                <TableCell>{u.full_name}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'approved' : 'secondary'} className={u.role === 'admin' ? 'capitalize' : 'capitalize bg-soft-green text-[#0C765E]'}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[12px] text-muted-green">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green transition hover:bg-soft-green hover:text-forest" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${u.username}`} className="h-8 w-8 rounded-full p-0 text-red-500 transition hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && <TableRow className="border-0"><TableCell colSpan={6} className="py-14 text-center text-[13.5px] text-muted-green">No users found</TableCell></TableRow>}
          </TableBody>
        </Table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="border-[#E6EDE9] bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-forest">{editing ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>{editing ? 'Update user account details' : 'Create a new system user'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required className="rounded-xl border-[#DCEBE5] bg-ivory" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{editing ? 'New Password (leave blank to keep)' : 'Password'}</Label>
              <Input id="password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editing} className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                <SelectTrigger className="rounded-xl border-[#DCEBE5] bg-ivory"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green transition hover:bg-soft-green hover:text-forest" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" className="gradient-btn rounded-full">{editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}