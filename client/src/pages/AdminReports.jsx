import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  LayoutDashboard, FileText, Users, FolderTree, Eye, BarChart3, Clock, CheckCircle2, XCircle, ArrowRight, TrendingUp, TrendingDown, Calendar, Search, X, Printer
} from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, chip, trend, trendLabel }) => (
  <div className="admin-stat">
    <div className={`admin-stat-chip ${chip}`}><Icon className="h-5 w-5" /></div>
    <div className="min-w-0">
      <div className="flex items-baseline gap-1">
        <p className="admin-stat-value">{value}</p>
        {trend !== undefined && (
          <span className={`text-[11px] font-semibold leading-none ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="admin-stat-label">{label}</p>
      {trendLabel && <p className="text-[10px] text-[#607B72] mt-0.5">{trendLabel}</p>}
    </div>
  </div>
);

const EMPTY_TOTALS = { total: 0, approved: 0, pending: 0, rejected: 0, views: 0 };

export default function AdminReports() {
  const [stats, setStats] = useState(null);
  const [topViews, setTopViews] = useState([]);
  const [byProgram, setByProgram] = useState([]);
  const [byYear, setByYear] = useState([]);
  const [loading, setLoading] = useState(true);

  const [programList, setProgramList] = useState([]);
  const [programFilter, setProgramFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');

  useEffect(() => {
    axios.get(`${API}/stats/`).then(r => {
      if (r.data && !Array.isArray(r.data)) {
        setStats(r.data);
        setTopViews(r.data.topViews || []);
        setByProgram(r.data.byProgram || []);
        setByYear(r.data.byYear || []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    axios.get(`${API}/programs/`).then(r => { if (Array.isArray(r.data)) setProgramList(r.data); }).catch(() => {});
  }, []);

  const matrix = useMemo(() => (Array.isArray(stats?.byProgramYear) ? stats.byProgramYear : []), [stats]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    (Array.isArray(stats?.years) ? stats.years : []).forEach(y => { if (y != null) set.add(Number(y)); });
    matrix.forEach(r => { if (r.year != null) set.add(Number(r.year)); });
    return [...set].sort((a, b) => b - a);
  }, [stats, matrix]);

  const hasUnassigned = useMemo(() => matrix.some(r => !r.program_code), [matrix]);

  const filteredRows = useMemo(() => matrix.filter(row => {
    const programOk = !programFilter
      || (programFilter === '__none' ? !row.program_code : row.program_code === programFilter);
    const yearOk = !yearFilter || String(row.year) === yearFilter;
    return programOk && yearOk;
  }), [matrix, programFilter, yearFilter]);

  const groups = useMemo(() => filteredRows.map(row => ({
    key: `${row.program_code || '__none'}-${row.year}`,
    label: row.program_name || 'Unassigned',
    year: row.year,
    total: row.total,
    approved: row.approved,
    pending: row.pending,
    rejected: row.rejected,
    views: row.views,
  })).sort((a, b) => (b.year - a.year) || a.label.localeCompare(b.label)), [filteredRows]);

  const visibleGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter(g => `${g.label} ${g.year ?? ''}`.toLowerCase().includes(term));
  }, [groups, query]);

  const filteredTotals = useMemo(
    () => visibleGroups.reduce((acc, g) => ({
      total: acc.total + g.total,
      approved: acc.approved + g.approved,
      pending: acc.pending + g.pending,
      rejected: acc.rejected + g.rejected,
      views: acc.views + g.views,
    }), { ...EMPTY_TOTALS }),
    [visibleGroups]
  );

  const maxGroupTotal = Math.max(1, ...visibleGroups.map(g => g.total));
  const hasTabFilters = Boolean(programFilter || yearFilter || query);
  const clearTabFilters = () => {
    setProgramFilter('');
    setYearFilter('');
    setQuery('');
    setDraftQuery('');
  };
  const groupNoun = visibleGroups.length === 1 ? 'program-year group' : 'program-year groups';

  // The filter bar is hidden in print, so the PDF summary spells out what is applied
  const activeFilterLabels = useMemo(() => {
    const labels = [];
    if (programFilter) {
      labels.push(programFilter === '__none'
        ? 'Unassigned'
        : (programList.find(p => p.code === programFilter)?.name || programFilter));
    }
    if (yearFilter) labels.push(`Year ${yearFilter}`);
    if (query.trim()) labels.push(`Search "${query.trim()}"`);
    return labels;
  }, [programFilter, yearFilter, query, programList]);

  const pct = (part, whole) => whole ? Math.round((part / whole) * 100) : 0;

  const handleExportPdf = () => {
    const previousTitle = document.title;
    const stamp = new Date().toLocaleDateString('en-CA');
    document.title = `ResearchHub Reports ${stamp}`;
    window.print();
    document.title = previousTitle;
  };

  if (loading) return <div className="admin-page flex h-64 items-center justify-center"><div className="text-[15px] font-semibold text-muted-green">Loading analytics...</div></div>;

  const maxViews = Math.max(1, ...topViews.map(t => t.views));
  const maxProg = Math.max(1, ...byProgram.map(p => p.count));
  const programTotal = Math.max(1, byProgram.reduce((sum, p) => sum + p.count, 0));
  const maxYearCount = Math.max(1, ...byYear.map(y => y.count));

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="admin-eyebrow print:hidden">
            <BarChart3 className="h-3 w-3" />
            Analytics
          </span>
          <h1 className="admin-title mt-3">Reports <em>&amp; Analytics</em></h1>
          <p className="admin-subtitle">Repository performance and viewer insights</p>
          <p className="mt-1 hidden text-[12px] text-[#607B72] print:block">
            Generated {new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-4 print:hidden">
          <Link to="/admin/research" className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[#0C765E] transition hover:text-forest">
            View Catalog <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Button onClick={handleExportPdf} className="h-9 shrink-0 rounded-full px-4 text-[13px]">
            <Printer className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="hidden print:mt-4 print:block print:h-px print:bg-[#DCE9E3]" />
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <StatCard
          label="Total Research"
          value={stats?.total ?? 0}
          icon={FileText}
          chip="bg-[#E8F3EE] text-[#0C765E]"
        />
        <StatCard
          label="Total Views"
          value={stats?.total_views ?? 0}
          icon={Eye}
          chip="bg-soft-blue text-blue-700"
          trend={stats?.total ? pct(stats?.approved ?? 0, stats?.total) : 0}
          trendLabel="Approval rate"
        />
        <StatCard
          label="Users"
          value={stats?.users ?? 0}
          icon={Users}
          chip="bg-pale-green text-[#0C765E]"
        />
        <StatCard
          label="Programs"
          value={stats?.programs ?? 0}
          icon={FolderTree}
          chip="bg-mint-dark text-deep-green"
        />
        <StatCard
          label="Approved"
          value={stats?.approved ?? 0}
          icon={CheckCircle2}
          chip="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Pending"
          value={stats?.pending ?? 0}
          icon={Clock}
          chip="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Rejected"
          value={stats?.rejected ?? 0}
          icon={XCircle}
          chip="bg-red-100 text-red-700"
        />
      </div>

      {/* Search Breakdown */}
      <Card>
        <div className="admin-panel-body">
          <h2 className="sr-only">Search Breakdown</h2>
          <form
            className="admin-filterbar print:hidden"
            onSubmit={e => { e.preventDefault(); setQuery(draftQuery.trim()); }}
          >
            <div className="admin-search">
              <Search className="h-4 w-4 shrink-0" />
              <input
                type="search"
                value={draftQuery}
                onChange={e => setDraftQuery(e.target.value)}
                placeholder="Search program or year..."
                aria-label="Search breakdown"
              />
            </div>
            <select
              className="admin-select"
              value={programFilter}
              onChange={e => setProgramFilter(e.target.value)}
              aria-label="Filter by program"
            >
              <option value="">All Programs</option>
              {programList.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
              {hasUnassigned && <option value="__none">Unassigned</option>}
            </select>
            <select
              className="admin-select"
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              aria-label="Filter by year"
            >
              <option value="">All Years</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="submit" className="admin-search-btn print:hidden">
              <Search className="h-3.5 w-3.5" /> Search
            </button>
            {hasTabFilters && (
              <button type="button" className="admin-filter-reset print:hidden" onClick={clearTabFilters}>
                <X className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </form>

          <div className="hidden print:mb-3 print:flex print:items-center print:gap-2">
            <FolderTree className="h-4 w-4 text-emerald-brand" />
            <h2 className="text-[15px] font-semibold text-[#103F37]">Research by Program &amp; Year</h2>
          </div>

          <p className="mt-4 text-[12.5px] text-[#607B72] print:mt-0">
            <span className="font-semibold text-forest">{filteredTotals.total}</span> works across{' '}
            <span className="font-semibold text-forest">{visibleGroups.length}</span> {groupNoun}
            {' · '}
            <span className="font-semibold text-forest">{filteredTotals.views.toLocaleString()}</span> views
            {activeFilterLabels.length > 0 && (
              <span className="hidden print:inline"> · Filters: {activeFilterLabels.join(', ')}</span>
            )}
          </p>

          <div className="table-scroll mt-3">
            {visibleGroups.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[14px] font-semibold text-forest">No data for this selection</p>
                <p className="mt-1 text-[13px] text-[#607B72]">Try a different program, year, or search term.</p>
                {hasTabFilters && (
                  <button type="button" className="admin-filter-reset mt-4 print:hidden" onClick={clearTabFilters}>
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </button>
                )}
              </div>
            ) : (
              <table className="admin-table w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Year</th>
                    <th>Works</th>
                    <th className="text-emerald-700">Approved</th>
                    <th className="text-amber-600">Pending</th>
                    <th className="text-red-600">Rejected</th>
                    <th>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map(g => (
                    <tr key={g.key}>
                      <td><span className="font-medium text-forest">{g.label}</span></td>
                      <td><span className="font-mono text-[13px] font-semibold text-forest">{g.year}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="w-7 text-right text-[13px] font-semibold text-forest">{g.total}</span>
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#E6EDE9] sm:w-28">
                            <div className="h-full rounded-full bg-emerald-brand" style={{ width: `${(g.total / maxGroupTotal) * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td><span className="font-semibold text-emerald-700">{g.approved}</span></td>
                      <td><span className="font-semibold text-amber-600">{g.pending}</span></td>
                      <td><span className="font-semibold text-red-600">{g.rejected}</span></td>
                      <td><span className="font-mono text-[12.5px] text-[#245D50]">{g.views.toLocaleString()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        {/* Top Viewed Research */}
        <Card className="min-w-0">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title"><Eye className="h-4 w-4 text-emerald-brand" /> Most Viewed Research</h2>
          </div>
          <div className="admin-panel-body space-y-2">
            {topViews.length === 0 ? (
              <p className="text-[13.5px] text-muted-green py-8 text-center">No view data yet</p>
            ) : (
              <div className="space-y-2">
                {topViews.map((item, i) => (
                  <div key={item.code} className="print-keep flex items-center gap-3 rounded-xl border border-[#E6EDE9] bg-white p-3 transition hover:border-[#CFE2DA] hover:bg-emerald-50/40">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E8F3EE] font-mono text-[11px] font-bold text-[#0C765E]">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-forest print:overflow-visible print:whitespace-normal">{item.title}</div>
                      <div className="font-mono text-[11px] text-[#607B72]">{item.code}</div>
                    </div>
                    <div className="flex w-24 shrink-0 items-center gap-2 sm:w-36">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6EDE9]">
                        <div
                          className="h-full rounded-full bg-emerald-brand"
                          style={{ width: `${(item.views / maxViews) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-[11px] font-semibold text-[#0C765E]">{item.views}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Distribution Overview */}
        <Card className="min-w-0">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title"><LayoutDashboard className="h-4 w-4 text-emerald-brand" /> Distribution Overview</h2>
          </div>
          <div className="admin-panel-body">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3">
              {[
                { key: 'approved', label: 'Approved', value: stats?.approved ?? 0, color: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-600', icon: CheckCircle2 },
                { key: 'pending', label: 'Pending', value: stats?.pending ?? 0, color: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', icon: Clock },
                { key: 'rejected', label: 'Rejected', value: stats?.rejected ?? 0, color: 'bg-red-100 text-red-700', bar: 'bg-red-500', icon: XCircle },
              ].map(item => {
                const total = (stats?.approved ?? 0) + (stats?.pending ?? 0) + (stats?.rejected ?? 0);
                return (
                  <Link
                    key={item.label}
                    to={`/admin/browse?status=${item.key}`}
                    className="print-keep rounded-2xl border border-[#E6EDE9] bg-white p-4 transition hover:border-[#CFE2DA] hover:bg-emerald-50/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.color}`}>
                          <item.icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-forest">{item.label}</div>
                          <div className="text-[11px] text-[#607B72]">{total ? `${pct(item.value, total)}% of total` : '0%'}</div>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[16px] font-semibold text-forest">{item.value}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E6EDE9]">
                      <div className={`h-full rounded-full ${item.bar}`} style={{ width: total ? `${(item.value / total) * 100}%` : '0%' }} />
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 border-t border-[#E9F0EC] pt-5 lg:grid-cols-2 print:mt-4 print:grid-cols-2 print:gap-5 print:pt-4">
              <section className="min-w-0">
                <h3 className="mb-3 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#607B72]">
                  <FolderTree className="h-3.5 w-3.5 text-emerald-brand" /> Research by Program
                </h3>
                {byProgram.length === 0 ? (
                  <p className="text-[13.5px] text-muted-green py-6 text-center">No program data yet</p>
                ) : (
                  <div className="space-y-2">
                    {byProgram.map(item => (
                      <Link
                        key={item.program}
                        to={item.program_code ? `/admin/browse?program=${encodeURIComponent(item.program_code)}` : '/admin/browse'}
                        className="print-keep flex items-center gap-3 rounded-xl border border-[#E6EDE9] bg-white p-3 transition hover:border-[#CFE2DA] hover:bg-emerald-50/40"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E8F3EE] text-[#0C765E]">
                          <FolderTree className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold text-forest print:overflow-visible print:whitespace-normal">{item.program || 'Unassigned'}</div>
                          <div className="text-[11px] text-[#607B72]">{pct(item.count, programTotal)}% of works</div>
                        </div>
                        <div className="flex w-24 shrink-0 items-center gap-2 sm:w-36">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6EDE9]">
                            <div
                              className="h-full rounded-full bg-[#08755B]"
                              style={{ width: `${(item.count / maxProg) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right font-mono text-[11px] font-semibold text-[#0C765E]">{item.count}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="min-w-0 lg:border-l lg:border-[#E9F0EC] lg:pl-6 print:border-l print:border-[#E9F0EC] print:pl-5">
                <h3 className="mb-3 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#607B72]">
                  <Calendar className="h-3.5 w-3.5 text-emerald-brand" /> Research by Year
                </h3>
                {byYear.length === 0 ? (
                  <p className="text-[13.5px] text-muted-green py-6 text-center">No year data yet</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {byYear.map(item => (
                      <Link
                        key={item.year}
                        to={`/admin/browse?year=${item.year}`}
                        className="print-keep flex items-center gap-2 rounded-lg border border-[#E6EDE9] bg-white px-2.5 py-2 transition hover:border-[#CFE2DA] hover:bg-emerald-50/40"
                      >
                        <span className="flex h-5 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F3EE] font-mono text-[10px] font-bold text-[#0C765E]">{item.year}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6EDE9]">
                          <div className="h-full rounded-full bg-emerald-brand" style={{ width: `${(item.count / maxYearCount) * 100}%` }} />
                        </div>
                        <span className="w-7 shrink-0 text-right font-mono text-[10.5px] font-semibold text-[#0C765E]">{item.count}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
