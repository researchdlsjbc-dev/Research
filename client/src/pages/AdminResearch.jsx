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

          <div className="table-scroll">
          <table className="admin-table w-full table-fixed min-w-[1196px] border-collapse">
            <thead>
              <tr>
                <th style={{ width: 124 }}>Code</th>
                <th style={{ width: 284 }}>Title</th>
                <th style={{ width: 196 }}>Authors</th>
                <th className="text-center" style={{ width: 56 }}>Year</th>
                <th className="text-center" style={{ width: 60 }}>Views</th>
                <th style={{ width: 108 }}>Status</th>
                <th className="text-center" style={{ width: 80 }}>Featured</th>
                <th className="text-right" style={{ width: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {research.map(r => (
                <tr key={r.id}>
                  <td className="font-mono text-[12px] font-semibold text-[#0C765E]"><span className="block truncate" title={r.code}>{r.code}</span></td>
                  <td>
                    <Link to={`/admin/research/${r.id}`} className="block truncate text-[14px] font-semibold leading-[1.4] text-forest transition hover:text-[#0C765E] hover:underline" title={r.title}>{r.title}</Link>
                  </td>
                  <td><span className="block truncate text-[13px] leading-[1.5] text-[#55736C]" title={r.authors}>{r.authors}</span></td>
                  <td className="text-center font-mono text-muted-green">{r.year}</td>
                  <td className="text-center font-mono text-muted-green">{r.view_count ?? 0}</td>
                  <td><Badge variant={r.status} className="whitespace-nowrap capitalize">{r.status}</Badge></td>
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => toggleFeatured(r)}
                      title={r.is_featured ? 'Remove from featured' : 'Feature on home page'}
                      aria-label={r.is_featured ? `Unfeature ${r.title}` : `Feature ${r.title}`}
                      className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border transition ${r.is_featured ? 'border-amber-200 bg-amber-50 text-amber-500' : 'border-[#DCEBE5] text-[#B9C9C3] hover:bg-soft-green hover:text-amber-500'}`}
                    >
                      <Star className={`h-4 w-4 ${r.is_featured ? 'fill-current' : ''}`} />
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      {r.status !== 'approved' && <button type="button" onClick={() => updateStatus(r.id, 'approved')} className="gradient-btn flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>}
                      {r.status !== 'rejected' && <button type="button" aria-label="Reject" title="Reject" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700" onClick={() => updateStatus(r.id, 'rejected')}><XCircle className="h-3.5 w-3.5" /></button>}
                      {r.status !== 'pending' && <button type="button" aria-label="Move to pending" title="Move to pending" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#DCEBE5] text-amber-600 transition hover:bg-amber-50" onClick={() => updateStatus(r.id, 'pending')}><RotateCcw className="h-3.5 w-3.5" /></button>}
                      <Link to={`/edit-research/${r.id}`} aria-label="Edit" title="Edit" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#DCEBE5] text-muted-green transition hover:bg-soft-green hover:text-forest"><Pencil className="h-3.5 w-3.5" /></Link>
                      <button type="button" aria-label="Delete" title="Delete" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {research.length === 0 && <tr><td colSpan={8} className="py-14 text-center text-[13.5px] text-muted-green">No research found</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </Tabs>
    </div>
  );
}