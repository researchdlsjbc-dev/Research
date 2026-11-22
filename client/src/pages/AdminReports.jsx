import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  LayoutDashboard, FileText, Users, FolderTree, Eye, BarChart3, Clock, CheckCircle2, XCircle, ArrowRight, TrendingUp, TrendingDown, Calendar
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

export default function AdminReports() {
  const [stats, setStats] = useState(null);
  const [topViews, setTopViews] = useState([]);
  const [byProgram, setByProgram] = useState([]);
  const [byYear, setByYear] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const pct = (part, whole) => whole ? Math.round((part / whole) * 100) : 0;

  if (loading) return <div className="admin-page flex h-64 items-center justify-center"><div className="text-[15px] font-semibold text-muted-green">Loading analytics...</div></div>;

  const maxViews = Math.max(1, ...topViews.map(t => t.views));
  const maxProg = Math.max(1, ...byProgram.map(p => p.count));

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="admin-eyebrow">
            <BarChart3 className="h-3 w-3" />
            Analytics
          </span>
          <h1 className="admin-title mt-3">Reports <em>&amp; Analytics</em></h1>
          <p className="admin-subtitle">Repository performance and viewer insights</p>
        </div>
        <Link to="/admin/research" className="text-[13px] font-semibold text-[#0C765E] transition hover:text-forest">
          View Catalog <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Top Viewed Research */}
        <Card className="lg:col-span-2">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title"><Eye className="h-4 w-4 text-emerald-brand" /> Most Viewed Research</h2>
          </div>
          <div className="admin-panel-body space-y-2">
            {topViews.length === 0 ? (
              <p className="text-[13.5px] text-muted-green py-8 text-center">No view data yet</p>
            ) : (
              <div className="space-y-2">
                {topViews.map((item, i) => (
                  <div key={item.code} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-emerald-50/50 transition">
                    <span className="font-mono text-xs font-semibold text-muted-green w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-forest truncate">{item.title}</div>
                      <div className="text-[11px] text-[#607B72] font-mono">{item.code}</div>
                    </div>
                    <div className="w-24">
                      <div className="flex items-end gap-1">
                        <div
                          className="bg-emerald-brand rounded-t-lg transition-origin"
                          style={{ height: `${(item.views / maxViews) * 100}%`, transformOrigin: 'bottom' }}
                        />
                        <span className="text-[11px] font-mono font-semibold text-[#0C765E]">{item.views}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Research by Program */}
        <Card>
          <div className="admin-panel-head">
            <h2 className="admin-panel-title"><FolderTree className="h-4 w-4 text-emerald-brand" /> Research by Program</h2>
          </div>
          <div className="admin-panel-body space-y-2">
            {byProgram.length === 0 ? (
              <p className="text-[13.5px] text-muted-green py-8 text-center">No program data yet</p>
            ) : (
              <div className="space-y-2">
                {byProgram.map((item, i) => (
                  <div key={item.program} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-emerald-50/50 transition">
                    <span className="font-mono text-xs font-semibold text-muted-green w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-forest truncate">{item.program}</div>
                    </div>
                    <div className="w-24">
                      <div className="flex items-end gap-1">
                        <div
                          className="bg-[#08755B] rounded-t-lg transition-origin"
                          style={{ height: `${(item.count / maxProg) * 100}%`, transformOrigin: 'bottom' }}
                        />
                        <span className="text-[11px] font-mono font-semibold text-[#0C765E]">{item.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Research by Year */}
        <Card>
          <div className="admin-panel-head">
            <h2 className="admin-panel-title"><Calendar className="h-4 w-4 text-emerald-brand" /> Research by Year</h2>
          </div>
          <div className="admin-panel-body space-y-2">
            {byYear.length === 0 ? (
              <p className="text-[13.5px] text-muted-green py-8 text-center">No year data yet</p>
            ) : (
              <div className="space-y-2">
                {byYear.map((item, i) => {
                  const maxYear = Math.max(1, ...byYear.map(y => y.count));
                  return (
                    <div key={item.year} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-emerald-50/50 transition">
                      <span className="font-mono text-xs font-semibold text-muted-green w-8">{item.year}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="h-2 bg-[#08755B]/10 rounded-full">
                            <div className="h-full bg-emerald-brand rounded-full" style={{ width: `${(item.count / maxYear) * 100}%` }} />
                          </div>
                          <span className="text-[12px] font-mono font-semibold text-[#0C765E]">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <div className="admin-panel-head">
          <h2 className="admin-panel-title"><LayoutDashboard className="h-4 w-4 text-emerald-brand" /> Status Breakdown</h2>
        </div>
        <div className="admin-panel-body grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Approved', value: stats?.approved ?? 0, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
            { label: 'Pending', value: stats?.pending ?? 0, color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
            { label: 'Rejected', value: stats?.rejected ?? 0, color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
          ].map((item, i) => {
            const total = (stats?.approved ?? 0) + (stats?.pending ?? 0) + (stats?.rejected ?? 0);
            return (
              <div key={item.label} className="p-4 rounded-2xl border border-border/50 bg-white/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.color.split(' ')[0]}`} />
                    <span className="text-sm font-semibold text-forest">{item.label}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-muted-green">{item.value}</span>
                </div>
                <div className="h-1.5 bg-[#E6EDE9] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-brand" style={{ width: total ? `${(item.value / total) * 100}%` : '0%' }} />
                </div>
                <p className="text-[11px] text-[#607B72] mt-1">{total ? `${pct(item.value, total)}% of total` : '0%'}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
