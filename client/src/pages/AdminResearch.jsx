import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Tabs, TabsList, TabsTrigger,
} from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Search, CheckCircle2, XCircle, RotateCcw, Pencil, Trash2, Star, BookMarked, Plus } from 'lucide-react';

export default function AdminResearch() {
  const [research, setResearch] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchData = () => {
    const params = {};
    if (filter === 'featured') params.featured = 1;
    else if (filter !== 'all') params.status = filter;
    if (search) params.search = search;
    axios.get(`${API}/research/all`, { params }).then(r => { if (Array.isArray(r.data)) setResearch(r.data); }).catch(() => {});
  };

  useEffect(() => { fetchData(); }, [filter]);

  const updateStatus = (id, status) => {
    axios.patch(`${API}/research/${id}/status`, { status }).then(() => fetchData());
  };

  const toggleFeatured = async (item) => {
    const next = !item.is_featured;
    setResearch(prev => prev.map(r => (r.id === item.id ? { ...r, is_featured: next } : r)));
    try {
      await axios.patch(`${API}/research/${item.id}/featured`, { is_featured: next });
      fetchData();
    } catch (err) {
      setResearch(prev => prev.map(r => (r.id === item.id ? { ...r, is_featured: item.is_featured } : r)));
      alert(err.response?.data?.error || 'Could not update featured status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this research?')) return;
    await axios.delete(`${API}/research/${id}`);
    fetchData();
  };

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="admin-eyebrow">
            <BookMarked className="h-3 w-3" />
            Catalog
          </span>
          <h1 className="admin-title mt-3">Manage <em>Research</em></h1>
          <p className="admin-subtitle">Approve, reject, edit, or remove research records</p>
        </div>
        <Link to="/submit">
          <Button className="gradient-btn rounded-full">
            <Plus className="h-4 w-4" /> New Submission
          </Button>
        </Link>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex flex-wrap gap-1.5 rounded-full border border-[#E6EDE9] bg-white p-1.5">
          {[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'featured', label: 'Featured' },
          ].map(t => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-muted-green transition data-[state=active]:bg-emerald-brand data-[state=active]:text-white"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="admin-panel mt-5 overflow-hidden">
          <div className="admin-panel-head">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8AA79E]" />
              <Input
                placeholder="Search by title, author, or code"
                aria-label="Search research"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchData()}
                className="h-10 rounded-full border-[#DCEBE5] bg-ivory pl-10 text-[13.5px] focus-visible:border-emerald-brand"
              />
            </div>
            <Button className="gradient-btn rounded-full" onClick={fetchData}>Search</Button>
          </div>

          <Table className="admin-table">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Authors</TableHead><TableHead>Year</TableHead><TableHead className="text-center">Views</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Featured</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {research.map(r => (
                <TableRow key={r.id} className="border-0">
                  <TableCell className="font-mono text-[12px] font-semibold text-[#0C765E]">{r.code}</TableCell>
                  <TableCell>
                    <Link to={`/admin/research/${r.id}`} className="font-medium text-forest transition hover:text-[#0C765E] hover:underline">{r.title}</Link>
                  </TableCell>
                  <TableCell className="text-muted-green">{r.authors}</TableCell>
                  <TableCell className="font-mono text-muted-green">{r.year}</TableCell>
                  <TableCell className="text-center font-mono text-muted-green">{r.view_count ?? 0}</TableCell>
                  <TableCell><Badge variant={r.status} className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleFeatured(r)}
                      title={r.is_featured ? 'Remove from featured' : 'Feature on home page'}
                      aria-label={r.is_featured ? `Unfeature ${r.title}` : `Feature ${r.title}`}
                      className={`h-8 w-8 rounded-full p-0 ${r.is_featured ? 'text-amber-500 hover:bg-amber-50' : 'text-[#B9C9C3] hover:bg-soft-green hover:text-amber-500'}`}
                    >
                      <Star className={`h-4 w-4 ${r.is_featured ? 'fill-current' : ''}`} />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {r.status !== 'approved' && <Button size="sm" className="gradient-btn rounded-full" onClick={() => updateStatus(r.id, 'approved')}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>}
                      {r.status !== 'rejected' && <Button size="sm" variant="outline" aria-label="Reject" className="h-8 w-8 rounded-full p-0 border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700" onClick={() => updateStatus(r.id, 'rejected')}><XCircle className="h-3.5 w-3.5" /></Button>}
                      {r.status !== 'pending' && <Button size="sm" variant="outline" aria-label="Move to pending" className="h-8 w-8 rounded-full p-0 border-[#DCEBE5] text-amber-600 transition hover:bg-amber-50" onClick={() => updateStatus(r.id, 'pending')}><RotateCcw className="h-3.5 w-3.5" /></Button>}
                      <Link to={`/edit-research/${r.id}`}><Button size="sm" variant="outline" aria-label="Edit" className="h-8 w-8 rounded-full p-0 border-[#DCEBE5] text-muted-green transition hover:bg-soft-green hover:text-forest"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Button size="sm" variant="ghost" aria-label="Delete" className="h-8 w-8 rounded-full p-0 text-red-500 transition hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {research.length === 0 && <TableRow className="border-0"><TableCell colSpan={8} className="py-14 text-center text-[13.5px] text-muted-green">No research found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Tabs>
    </div>
  );
}