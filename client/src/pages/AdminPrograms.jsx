import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { FolderTree, Pencil, Trash2, Plus } from 'lucide-react';

export default function AdminPrograms() {
  const [programs, setPrograms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '' });

  const fetchData = () => axios.get(`${API}/programs/`).then(r => { if (Array.isArray(r.data)) setPrograms(r.data); }).catch(() => {});
  useEffect(() => { fetchData(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: '', code: '' }); setShowModal(true); };
  const openEdit = (p) => { setEditing(p); setForm({ name: p.name, code: p.code }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await axios.put(`${API}/programs/${editing.id}`, form); }
      else { await axios.post(`${API}/programs/`, form); }
      setShowModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this program?')) return;
    await axios.delete(`${API}/programs/${id}`);
    fetchData();
  };

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="admin-eyebrow">
            <FolderTree className="h-3 w-3" />
            Academics
          </span>
          <h1 className="admin-title mt-3">Manage <em>Programs</em></h1>
          <p className="admin-subtitle">Academic programs available for research records</p>
        </div>
        <Button className="gradient-btn rounded-full" onClick={openNew}><Plus className="h-4 w-4" /> Add Program</Button>
      </div>

      <div className="admin-panel overflow-hidden">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title"><FolderTree className="h-4 w-4 text-emerald-brand" /> Academic Programs</h2>
          <span className="text-[13px] font-semibold text-muted-green">{programs.length} {programs.length === 1 ? 'program' : 'programs'}</span>
        </div>
        <div className="table-scroll">
        <Table className="admin-table min-w-[560px]">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead>ID</TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.map(p => (
              <TableRow key={p.id} className="border-0">
                <TableCell className="font-mono text-muted-green">{p.id}</TableCell>
                <TableCell><span className="code-tag bg-soft-green text-[#0C765E]">{p.code}</span></TableCell>
                <TableCell className="font-medium text-forest">{p.name}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green transition hover:bg-soft-green hover:text-forest" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${p.name}`} className="h-8 w-8 rounded-full p-0 text-red-500 transition hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {programs.length === 0 && <TableRow className="border-0"><TableCell colSpan={4} className="py-14 text-center text-[13.5px] text-muted-green">No programs found</TableCell></TableRow>}
          </TableBody>
        </Table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="border-[#E6EDE9] bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-forest">{editing ? 'Edit Program' : 'Add Program'}</DialogTitle>
            <DialogDescription>{editing ? 'Update program details' : 'Create a new academic program'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program-name">Program Name</Label>
              <Input id="program-name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-code">Program Code</Label>
              <Input id="program-code" value={form.code} onChange={e => setForm({...form, code: e.target.value})} required placeholder="e.g. CS" className="rounded-xl border-[#DCEBE5] bg-ivory" />
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