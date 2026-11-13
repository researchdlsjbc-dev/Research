import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Users, Search, Plus, MoreHorizontal, Mail, BookOpen } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import Pagination from '../components/Pagination';

const SORTS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'publications', label: 'Most Publications' },
  { value: 'recent', label: 'Recently Added' },
];

export default function AdminAuthors() {
  const [params, setParams] = useSearchParams();
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(params.get('q') || '');
  const [sort, setSort] = useState(params.get('sort') || 'name');

  useEffect(() => {
    setSearch(params.get('q') || '');
    setSort(params.get('sort') || 'name');
    setPage(1);
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get(`${API}/authors/`, { params: { search, page, limit: 20, sort } })
      .then(r => {
        if (cancelled) return;
        setAuthors(r.data.data);
        setTotal(r.data.total);
        setPages(r.data.pages);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, sort, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setParams(next => {
      const p = new URLSearchParams(next);
      if (search.trim()) p.set('q', search.trim());
      else p.delete('q');
      return p;
    });
  };

  const handleSortChange = (e) => {
    setPage(1);
    setSort(e.target.value);
    setParams(next => {
      const p = new URLSearchParams(next);
      if (e.target.value !== 'name') p.set('sort', e.target.value);
      else p.delete('sort');
      return p;
    });
  };

  const goToPage = useCallback((p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="admin-eyebrow"><Users className="h-3 w-3" /> Authors</span>
          <h1 className="admin-title mt-3">Manage <em>Authors</em></h1>
          <p className="admin-subtitle">Track researchers and their publication counts</p>
        </div>
        <Link to="/admin/authors/new">
          <Button className="gradient-btn rounded-full"><Plus className="h-4 w-4" /> New Author</Button>
        </Link>
      </div>

      <Card>
        <div className="admin-panel-head flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[280px] flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="author-search" className="sr-only">Search authors</label>
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8AA79E]"><Search className="h-4 w-4" /></span>
              <input id="author-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." className="w-full h-10 pl-11 pr-4 rounded-full border-[#DCEBE5] bg-ivory text-[13.5px] focus-visible:border-emerald-brand" />
            </div>
            <Button type="submit" className="gradient-btn rounded-full">Search</Button>
          </form>
          <div className="flex items-center gap-2">
            <label htmlFor="author-sort" className="text-[12px] text-[#607B72]">Sort:</label>
            <select id="author-sort" className="sort-select" value={sort} onChange={handleSortChange}>
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="px-4 pb-4 md:px-5 md:pb-5">
          <div className="table-scroll">
            {loading ? (
              <div className="space-y-3 py-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-12 w-[38px] animate-pulse rounded bg-soft-green" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-soft-green" />
                    <div className="h-4 w-24 animate-pulse rounded bg-soft-green" />
                    <div className="h-4 w-20 animate-pulse rounded bg-soft-green" />
                  </div>
                ))}
              </div>
            ) : authors.length === 0 ? (
              <div className="py-14 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-[#8AA79E]" />
                <h3 className="section-title text-[22px]">No authors found</h3>
                <p className="mx-auto mt-1.5 max-w-sm text-[14.5px] text-muted-green">Add your first author or adjust search filters.</p>
              </div>
            ) : (
              <table className="research-table">
                <thead>
                  <tr>
                    <th>Author</th>
                    <th>Contact</th>
                    <th>Affiliation</th>
                    <th className="text-center">Total Publications</th>
                    <th className="text-center">Approved</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authors.map(a => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/admin/authors/${a.id}`} className="font-medium text-forest hover:underline">{a.name}</Link>
                      </td>
                      <td>
                        {a.email && <a href={`mailto:${a.email}`} className="flex items-center gap-1 text-[13px] text-muted-green hover:text-forest"><Mail className="h-3.5 w-3.5" /> {a.email}</a>}
                      </td>
                      <td>{a.affiliation || <span className="text-[#A3B5AF]">—</span>}</td>
                      <td className="text-center font-mono text-[14px] text-[#0C765E]">{a.publication_count}</td>
                      <td className="text-center font-mono text-[14px] text-emerald-600">{a.approved_count}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to={`/admin/authors/${a.id}`} className="p-2 rounded-full text-muted-green hover:bg-soft-green hover:text-forest" title="View Details"><BookOpen className="h-4 w-4" /></Link>
                          <Link to={`/admin/authors/${a.id}/edit`} className="p-2 rounded-full text-muted-green hover:bg-soft-green hover:text-forest" title="Edit"><MoreHorizontal className="h-4 w-4" /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && authors.length > 0 && (
            <div className="table-footer">
              <p className="results-count">
                {total} author{total !== 1 ? 's' : ''}
                {pages > 1 && <> · page {page} of {pages}</>}
              </p>
              <Pagination page={page} pages={pages} onChange={goToPage} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}