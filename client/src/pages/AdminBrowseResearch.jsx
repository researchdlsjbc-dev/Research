import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { coverGradient, formatDate, pluralize } from '../lib/format';
import {
  Landmark, Search, SlidersHorizontal, FileText, FolderTree, BookOpen,
  ArrowRight, Users, X, Edit, Trash2, CheckCircle2, XCircle,
  Clock, RotateCcw, AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 15;

const SORTS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'author', label: 'Author A-Z' },
  { value: 'year', label: 'Newest Year' },
];

const statusConfig = {
  approved: { label: 'Approved', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending Review', class: 'bg-amber-100 text-amber-700 border-amber-200' },
  rejected: { label: 'Rejected', class: 'bg-red-100 text-red-700 border-red-200' },
  draft: { label: 'Draft', class: 'bg-slate-100 text-slate-700 border-slate-200' },
};

function AdminBrowseResearchContent() {
  const [params, setParams] = useSearchParams();

  const q = params.get('q') || '';
  const program = params.get('program') || '';
  const year = params.get('year') || '';
  const status = params.get('status') || '';

  const [draft, setDraft] = useState(q);
  const [sort, setSort] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);

  const [research, setResearch] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { setDraft(q); }, [q]);

  useEffect(() => {
    axios.get(`${API}/programs/`).then(r => { if (Array.isArray(r.data)) setPrograms(r.data); }).catch(() => {});
    axios.get(`${API}/stats/`).then(r => { if (r.data && !Array.isArray(r.data)) setStats(r.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const query = { page, limit: PAGE_SIZE };
    if (q) query.search = q;
    if (program) query.program = program;
    if (year) query.year = year;
    if (status && status !== 'all') query.status = status;
    else if (!status) query.status = 'all';

    axios.get(`${API}/research/`, { params: query })
      .then(r => {
        if (cancelled) return;
        setResearch(Array.isArray(r.data?.data) ? r.data.data : []);
        setPages(Number.isFinite(r.data?.pages) ? Math.max(1, r.data.pages) : 1);
        setTotal(Number.isFinite(r.data?.total) ? r.data.total : 0);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to fetch research:', err);
        setError(err.message || 'Failed to load research');
        setResearch([]);
        setPages(1);
        setTotal(0);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, program, year, status, page]);

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    setParams(next => {
      const p = new URLSearchParams(next);
      if (draft.trim()) p.set('q', draft.trim());
      else p.delete('q');
      return p;
    });
  };

  const setFilter = (key, value) => {
    setPage(1);
    setParams(next => {
      const p = new URLSearchParams(next);
      if (value) p.set(key, value);
      else p.delete(key);
      return p;
    });
  };

  const clearAll = () => {
    setDraft('');
    setPage(1);
    setParams({});
  };

  const years = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i),
    []
  );

  const sorted = useMemo(() => {
    const rows = [...research];
    switch (sort) {
      case 'title':
        return rows.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      case 'author':
        return rows.sort((a, b) => (a.authors || '').localeCompare(b.authors || ''));
      case 'year':
        return rows.sort((a, b) => (b.year || 0) - (a.year || 0));
      default:
        return rows;
    }
  }, [research, sort]);

  const goToPage = useCallback((p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const hasFilters = Boolean(q || program || year || status);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.patch(`${API}/research/${id}/status`, { status: newStatus });
      setResearch(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this research?')) return;
    try {
      await axios.delete(`${API}/research/${id}`);
      setResearch(prev => prev.filter(r => r.id !== id));
      setTotal(prev => prev - 1);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (error) {
    return (
      <div className="admin-page space-y-6">
        <Card className="border-red-200">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">Failed to load research</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="gradient-btn">Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-page space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="admin-eyebrow">
            <Landmark className="h-3 w-3" />
            Catalog
          </span>
          <h1 className="admin-title mt-3">Browse <em>Research</em></h1>
          <p className="admin-subtitle">Search, filter, and manage all research works</p>
        </div>
        <Link to="/submit">
          <Button className="gradient-btn rounded-full">
            <span className="hidden sm:inline">New Submission</span>
            <span className="sm:hidden">+</span>
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="admin-stat">
          <div className="admin-stat-chip bg-[#E8F3EE] text-[#0C765E]"><FileText className="h-5 w-5" /></div>
          <div>
            <div className="admin-stat-value">{stats?.total ?? total}</div>
            <div className="admin-stat-label">Total Works</div>
          </div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-chip bg-amber-100 text-amber-700"><Clock className="h-5 w-5" /></div>
          <div>
            <div className="admin-stat-value">{research.filter(r => r.status === 'pending').length}</div>
            <div className="admin-stat-label">Pending Review</div>
          </div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-chip bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></div>
          <div>
            <div className="admin-stat-value">{research.filter(r => r.status === 'approved').length}</div>
            <div className="admin-stat-label">Approved</div>
          </div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-chip bg-[#E8F3EE] text-[#0C765E]"><FolderTree className="h-5 w-5" /></div>
          <div>
            <div className="admin-stat-value">{stats?.programs ?? programs.length}</div>
            <div className="admin-stat-label">Programs</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <div className="admin-panel-head flex flex-wrap gap-3">
          <form onSubmit={applySearch} className="flex-1 min-w-[280px] flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="admin-search" className="sr-only">Search all works</label>
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8AA79E]">
                <Search className="h-4 w-4" />
              </span>
              <input
                id="admin-search"
                type="search"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Search titles, authors, codes..."
                className="w-full h-10 pl-11 pr-4 rounded-full border-[#DCEBE5] bg-ivory text-[13.5px] focus-visible:border-emerald-brand"
              />
            </div>
            <button
              type="button"
              className="advanced-filter-button justify-center whitespace-nowrap"
              aria-expanded={showFilters}
              aria-controls="admin-advanced-filters"
              onClick={() => setShowFilters(v => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Advanced Filters</span>
            </button>
          </form>
        </div>

        {showFilters && (
          <div id="admin-advanced-filters" className="border-t border-[#E6EDE9] pt-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="filter-program" className="eyebrow mb-1.5 block">Program</label>
                <select
                  id="filter-program"
                  className="sort-select w-full"
                  value={program}
                  onChange={e => setFilter('program', e.target.value)}
                >
                  <option value="">All Programs</option>
                  {programs.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="filter-year" className="eyebrow mb-1.5 block">Year</label>
                <select
                  id="filter-year"
                  className="sort-select w-full"
                  value={year}
                  onChange={e => setFilter('year', e.target.value)}
                >
                  <option value="">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="filter-status" className="eyebrow mb-1.5 block">Status</label>
                <select
                  id="filter-status"
                  className="sort-select w-full"
                  value={status}
                  onChange={e => setFilter('status', e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="flex gap-2 w-full">
                  <button type="submit" onClick={applySearch} className="hero-cta flex-1">Apply Filters</button>
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="px-4 py-2 rounded-full border border-[#DCEBE5] bg-white text-[13px] font-semibold text-muted-green transition hover:border-[#CFE2DA] hover:bg-soft-green hover:text-forest"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>

            {hasFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-[#607B72]">Active filters:</span>
                {q && (
                  <button type="button" onClick={() => setFilter('q', '')} className="program-badge gap-1">
                    “{q}” <X className="h-3 w-3" />
                  </button>
                )}
                {program && (
                  <button type="button" onClick={() => setFilter('program', '')} className="program-badge gap-1">
                    {program} <X className="h-3 w-3" />
                  </button>
                )}
                {year && (
                  <button type="button" onClick={() => setFilter('year', '')} className="program-badge gap-1">
                    {year} <X className="h-3 w-3" />
                  </button>
                )}
                {status && (
                  <button type="button" onClick={() => setFilter('status', '')} className="program-badge gap-1">
                    {status} <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Results Table */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="icon-disc">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h2 className="section-title text-[23px]">Research Catalog</h2>
              <p className="section-sub">Manage and browse all research submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="admin-sort" className="text-[12px] text-[#607B72]">Sort by:</label>
            <select
              id="admin-sort"
              className="sort-select"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="table-scroll">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-12 w-[38px] animate-pulse rounded bg-soft-green" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-soft-green" />
                  <div className="hidden h-4 w-32 animate-pulse rounded bg-soft-green sm:block" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-14 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-soft-green text-emerald-brand">
                <BookOpen className="h-6 w-6" />
              </span>
              <h3 className="section-title text-[22px]">No research found</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-[14.5px] text-muted-green">
                {hasFilters
                  ? 'Try a different search term, or clear the active filters.'
                  : 'Nothing has been catalogued yet.'}
              </p>
              {hasFilters && (
                <button type="button" onClick={clearAll} className="hero-cta mt-5">
                  <span>Clear filters</span>
                </button>
              )}
            </div>
          ) : (
            <table className="research-table">
              <thead>
                <tr>
                  <th style={{ width: 52 }}><span className="sr-only">Cover</span></th>
                  <th>Title</th>
                  <th>Author(s)</th>
                  <th>Program</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Date Added</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <div className="thumb" style={{ background: coverGradient(i) }}>
                        <BookOpen className="h-4 w-4 text-white/80" />
                      </div>
                    </td>
                    <td>
                      <div className="cell-title">{r.title}</div>
                      {r.adviser && <div className="cell-author">Adviser: {r.adviser}</div>}
                    </td>
                    <td><div className="cell-author">{r.authors || 'Unattributed'}</div></td>
                    <td>
                      {r.program_name
                        ? <span className="program-pill">{r.program_name}</span>
                        : <span className="text-[13px] text-[#A3B5AF]">—</span>}
                    </td>
                    <td><span className="text-[14px]">{r.year || '—'}</span></td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusConfig[r.status]?.class || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {statusConfig[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td><span className="text-[14px]">{formatDate(r.created_at) || '—'}</span></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Link to={`/admin/research/${r.id}`} className="view-details inline-flex items-center gap-1 text-[13.5px] font-semibold" title="View Admin Page">
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                        <Link to={`/edit-research/${r.id}`} className="p-2 rounded-full text-muted-green hover:bg-soft-green hover:text-forest transition" title="Edit">
                          <Edit className="h-4 w-4" />
                        </Link>
                        <div className="flex gap-1">
                          {r.status !== 'approved' && (
                            <button
                              className="p-2 rounded-full text-emerald-600 hover:bg-emerald-50 transition"
                              onClick={() => handleStatusChange(r.id, 'approved')}
                              title="Approve"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {r.status !== 'rejected' && (
                            <button
                              className="p-2 rounded-full text-red-600 hover:bg-red-50 transition"
                              onClick={() => handleStatusChange(r.id, 'rejected')}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          {r.status !== 'pending' && (
                            <button
                              className="p-2 rounded-full text-amber-600 hover:bg-amber-50 transition"
                              onClick={() => handleStatusChange(r.id, 'pending')}
                              title="Move to Pending"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            className="p-2 rounded-full text-red-500 hover:bg-red-50 transition"
                            onClick={() => handleDelete(r.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && sorted.length > 0 && (
          <div className="table-footer">
            <p className="results-count">
              {pluralize(total, 'research result')}
              {pages > 1 && <> · page {page} of {pages}</>}
            </p>
            <Pagination page={page} pages={pages} onChange={goToPage} />
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AdminBrowseResearch() {
  return (
    <AdminBrowseResearchContent />
  );
}