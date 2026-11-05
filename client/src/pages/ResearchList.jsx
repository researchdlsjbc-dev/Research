import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { coverGradient, formatDate, pluralize } from '../lib/format';
import {
  Landmark, Search, SlidersHorizontal, FileText, FolderTree, BookOpen,
  ArrowRight, ChevronLeft, ChevronRight, Users, X,
} from 'lucide-react';

const PAGE_SIZE = 10;

const SORTS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'author', label: 'Author A-Z' },
  { value: 'year', label: 'Newest Year' },
];

function Pagination({ page, pages, onChange }) {
  if (pages < 1) return null;

  const visible = [];
  const push = (n) => { if (!visible.includes(n)) visible.push(n); };

  push(1);
  for (let p = page - 1; p <= page + 1; p += 1) if (p > 1 && p < pages) push(p);
  if (pages > 1) push(pages);
  visible.sort((a, b) => a - b);

  const items = [];
  visible.forEach((p, i) => {
    if (i > 0 && p - visible[i - 1] > 1) items.push('gap');
    items.push(p);
  });

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="page-btn"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {items.map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className="page-btn" aria-hidden="true">…</span>
        ) : (
          <button
            key={item}
            type="button"
            className={`page-btn${item === page ? ' is-active' : ''}`}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        className="page-btn"
        aria-label="Next page"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}

export default function ResearchList() {
  const [params, setParams] = useSearchParams();

  const q = params.get('q') || '';
  const program = params.get('program') || '';
  const year = params.get('year') || '';

  const [draft, setDraft] = useState(q);
  const [sort, setSort] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);

  const [research, setResearch] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [stats, setStats] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Keep the hero input in sync when the URL changes from elsewhere (header/footer search)
  useEffect(() => { setDraft(q); }, [q]);

  useEffect(() => {
    axios.get(`${API}/programs/`).then(r => { if (Array.isArray(r.data)) setPrograms(r.data); }).catch(() => {});
    axios.get(`${API}/stats/`).then(r => { if (r.data && !Array.isArray(r.data)) setStats(r.data); }).catch(() => {});
    axios.get(`${API}/research/`, { params: { featured: 1, limit: 4 } })
      .then(r => { if (Array.isArray(r.data?.data)) setFeatured(r.data.data); })
      .catch(() => {});

    // One wide fetch to build per-program counts for the sidebar
    axios.get(`${API}/research/`, { params: { limit: 500 } })
      .then(r => {
        const rows = Array.isArray(r.data?.data) ? r.data.data : [];
        setCounts(rows.reduce((acc, row) => {
          if (row.program_code) acc[row.program_code] = (acc[row.program_code] || 0) + 1;
          return acc;
        }, {}));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = { page, limit: PAGE_SIZE, status: 'all' };
    if (q) query.search = q;
    if (program) query.program = program;
    if (year) query.year = year;

    axios.get(`${API}/research/`, { params: query })
      .then(r => {
        if (cancelled) return;
        setResearch(Array.isArray(r.data?.data) ? r.data.data : []);
        setPages(Number.isFinite(r.data?.pages) ? Math.max(1, r.data.pages) : 1);
        setTotal(Number.isFinite(r.data?.total) ? r.data.total : 0);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResearch([]);
        setPages(1);
        setTotal(0);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, program, year, page]);

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

  const hasFilters = Boolean(q || program || year);

  return (
    <div className="bg-cream">
      {/* ================= CATALOG HERO ================= */}
      <section className="catalog-hero">
        <div className="container-page relative z-10 pb-24 pt-12 lg:pb-28 lg:pt-14">
          <div className="max-w-[640px]">
            <div className="eyebrow inline-flex items-center gap-2 text-[#176653]">
              <Landmark className="h-[13px] w-[13px]" />
              <span>Central Research Repository</span>
            </div>

            <h1 className="catalog-title mt-4">Browse Research Catalog</h1>

            <p className="mt-4 max-w-[540px] text-[15px] leading-[1.55] text-[#52736A]">
              Discover credible research, academic papers, and scholarly resources from our institution.
            </p>

            <form onSubmit={applySearch} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:flex-none min-w-0">
                <label htmlFor="catalog-search" className="sr-only">Search all works</label>
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0C765E]">
                  <Search className="h-[17px] w-[17px]" />
                </span>
                <input
                  id="catalog-search"
                  type="search"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Search all works, authors, or keywords..."
                  className="catalog-search-input w-full !pl-11 sm:w-[410px]"
                />
              </div>
              <button
                type="button"
                className="advanced-filter-button w-full sm:w-auto"
                aria-expanded={showFilters}
                aria-controls="advanced-filters"
                onClick={() => setShowFilters(v => !v)}
              >
                <SlidersHorizontal className="h-[15px] w-[15px]" />
                <span>Advanced Filters</span>
              </button>
            </form>

            {showFilters && (
              <div id="advanced-filters" className="latest-research-card mt-4 !p-4">
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-between gap-3 border-t border-[#EFF4F1] pt-3 w-full">
                  <button type="submit" onClick={applySearch} className="hero-cta w-full sm:w-auto">Apply Filters</button>
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="inline-flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-muted-green transition hover:text-forest w-full sm:w-auto"
                    >
                      <X className="h-3.5 w-3.5" /> Clear all
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-7 flex flex-wrap gap-2.5">
              <div className="stat-pill">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF3EF]">
                  <FileText className="h-[14px] w-[14px] text-[#0C765E]" />
                </span>
                <div>
                  <div className="stat-number">{stats?.total ?? total}</div>
                  <div className="stat-label">Total Works</div>
                </div>
              </div>
              <div className="stat-pill">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF3EF]">
                  <Users className="h-[14px] w-[14px] text-[#0C765E]" />
                </span>
                <div>
                  <div className="stat-number">{stats?.users ?? '—'}</div>
                  <div className="stat-label">Contributors</div>
                </div>
              </div>
              <div className="stat-pill">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF3EF]">
                  <FolderTree className="h-[14px] w-[14px] text-[#0C765E]" />
                </span>
                <div>
                  <div className="stat-number">{stats?.programs ?? programs.length}</div>
                  <div className="stat-label">Programs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CATALOG CONTENT ================= */}
      <main className="relative z-10 -mt-6">
        <div className="container-page pb-10">
          <div className="catalog-layout">
            {/* ---------- RESULTS ---------- */}
            <section className="latest-research-card">
              <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <span className="icon-disc">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="section-title text-[23px]">Latest Research</h2>
                    <p className="section-sub">Explore the most recent research works from our community.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="sort" className="text-[12px] text-[#607B72]">Sort by:</label>
                  <select
                    id="sort"
                    className="sort-select"
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                  >
                    {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
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
                </div>
              )}

              <div className="table-scroll mt-4">
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
                        <th style={{ width: 52 }} className="sr-only col-cover-header"><span className="sr-only">Cover</span></th>
                        <th className="col-title-header">Title</th>
                        <th className="col-program-header">Program</th>
                        <th className="col-year-header">Year</th>
                        <th className="col-date-header">Date Added</th>
                        <th className="col-actions-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r, i) => (
                        <tr key={r.id}>
                          <td className="col-cover">
                            <div className="thumb" style={{ background: coverGradient(i) }}>
                              <BookOpen className="h-4 w-4 text-white/80" />
                            </div>
                          </td>
                          <td className="col-title">
                            <div className="cell-title">{r.title}</div>
                            {r.adviser && <div className="cell-author">Adviser: {r.adviser}</div>}
                          </td>
                          <td className="col-program">
                            {r.program_name
                              ? <span className="program-pill">{r.program_name}</span>
                              : <span className="text-[13px] text-[#A3B5AF]">—</span>}
                          </td>
                          <td className="col-year"><span className="text-[14px]">{r.year || '—'}</span></td>
                          <td className="col-date"><span className="text-[14px]">{formatDate(r.created_at) || '—'}</span></td>
                          <td className="col-actions">
                            <Link to={`/research/${r.id}`} className="view-details inline-flex items-center gap-1 text-[13.5px] font-semibold">
                              View Details <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {!loading && sorted.length > 0 && (
                <>
                  <p className="results-count">
                    {pluralize(total, 'research result')} · page {page} of {pages}
                  </p>
                  <Pagination page={page} pages={pages} onChange={goToPage} />
                </>
              )}
            </section>

            {/* ---------- SIDEBAR ---------- */}
            <aside className="flex flex-col gap-5">
              <section className="sidebar-card">
                <h2 className="section-title text-[23px]">Featured Collections</h2>
                <p className="section-sub">Curated research works, hand-picked by the archive.</p>

                <div className="mt-3">
                  {featured.length === 0 ? (
                    <p className="py-4 text-[14px] text-muted-green">
                      No featured works yet.
                    </p>
                  ) : featured.map((r, i) => (
                    <Link key={r.id} to={`/research/${r.id}`} className="collection-row">
                      <span className="thumb !h-[46px] !w-[36px]" style={{ background: coverGradient(i) }}>
                        <BookOpen className="h-3.5 w-3.5 text-white/80" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="collection-title block truncate">{r.title}</span>
                        <span className="collection-count block">{r.authors || 'Unattributed'}</span>
                      </span>
                      <ArrowRight className="collection-arrow h-3.5 w-3.5 shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>

              <section className="sidebar-card">
                <h2 className="section-title text-[23px]">Browse by Program</h2>
                <p className="section-sub">Filter the catalog by a specific program.</p>

                <div className="mt-3">
                  {programs.length === 0 ? (
                    <p className="py-4 text-[14px] text-muted-green">No programs yet.</p>
                  ) : programs.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFilter('program', program === p.code ? '' : p.code)}
                      className={`collection-row w-full text-left ${program === p.code ? 'is-active' : ''}`}
                    >
                      <span className="thumb !h-[46px] !w-[36px]" style={{ background: coverGradient(i + 1) }}>
                        <FolderTree className="h-3.5 w-3.5 text-white/80" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="collection-title block truncate">{p.name}</span>
                        <span className="collection-count block">{pluralize(counts[p.code] || 0, 'work')}</span>
                      </span>
                      <ArrowRight className="collection-arrow h-3.5 w-3.5 shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}