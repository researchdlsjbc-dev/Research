import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { BookOpen, CheckCircle2, Clock, XCircle, Users, FolderTree, ArrowRight, FileText, LayoutDashboard, BarChart3 } from 'lucide-react';

const StatusIcon = ({ status }) => {
  const map = { approved: CheckCircle2, pending: Clock, rejected: XCircle };
  const Icon = map[status] || Clock;
  return <Icon className="h-3.5 w-3.5" />;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    axios.get(`${API}/stats/`).then(r => { if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) setStats(r.data); }).catch(() => {});
    axios.get(`${API}/research/?limit=5`).then(r => { if (Array.isArray(r.data?.data)) setRecent(r.data.data); }).catch(() => {});
  }, []);

  if (!stats) return <div className="flex h-64 items-center justify-center"><div className="text-[15px] font-semibold text-muted-green">Loading...</div></div>;

  const statCards = [
    { label: 'Total Research', value: stats.total, icon: BookOpen, chip: 'bg-soft-green text-emerald-brand', to: '/admin/browse' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, chip: 'bg-soft-green text-emerald-brand', to: '/admin/browse?status=approved' },
    { label: 'Pending', value: stats.pending, icon: Clock, chip: 'bg-amber-50 text-amber-700', to: '/admin/browse?status=pending' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, chip: 'bg-red-50 text-red-600', to: '/admin/browse?status=rejected' },
    { label: 'Users', value: stats.users, icon: Users, chip: 'bg-pale-green text-[#0C765E]', to: '/admin/users' },
    { label: 'Programs', value: stats.programs, icon: FolderTree, chip: 'bg-mint-dark text-deep-green', to: '/admin/programs' },
  ];

  const maxYearCount = Math.max(1, ...(stats.byYear || []).map(y => y.count));

  return (
    <div>
      <section className="dashboard-hero -mx-4 -mt-6 md:-mx-8 md:-mt-9">
        <div className="relative z-10 px-4 pb-24 pt-12 md:px-8 lg:pb-28 lg:pt-14">
          <div className="admin-page flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="admin-eyebrow">
                <LayoutDashboard className="h-3 w-3" />
                Overview
              </span>
              <h1 className="admin-title mt-3">The <em>Dashboard</em></h1>
              <p className="admin-subtitle">Overview of the research repository</p>
            </div>
            <Link to="/admin/research">
              <Button className="gradient-btn rounded-full">
                Manage Research <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="admin-page relative z-10 -mt-6 space-y-7">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {statCards.map(s => (
            <Link key={s.label} to={s.to} className="admin-stat focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-brand focus-visible:ring-offset-2">
              <span className={`admin-stat-chip ${s.chip}`}>
                <s.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="admin-stat-value">{s.value}</p>
                <p className="admin-stat-label">{s.label}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="admin-panel min-w-0 lg:col-span-2">
            <div className="admin-panel-head">
              <h2 className="admin-panel-title"><FileText className="h-4 w-4 text-emerald-brand" /> Recent Submissions</h2>
              <Link to="/admin/research" className="text-[13px] font-semibold text-[#0C765E] transition hover:text-forest">
                View All
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="px-6 py-14 text-center text-muted-green">
                <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-35" />
                <p className="text-[13.5px]">No submissions yet</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="admin-table w-full table-fixed min-w-[640px] border-collapse">
                  <thead>
                    <tr>
                      <th style={{ width: 124 }}>Code</th>
                      <th style={{ width: 330 }}>Title</th>
                      <th className="text-center" style={{ width: 56 }}>Year</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 44 }}><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(r => (
                      <tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/admin/research/${r.id}`)}>
                        <td className="font-mono text-[12px] font-semibold text-[#0C765E]"><span className="block truncate" title={r.code}>{r.code}</span></td>
                        <td>
                          <div className="truncate text-[14px] font-semibold leading-[1.4] text-forest" title={r.title}>{r.title}</div>
                          {r.authors && <div className="truncate text-[12px] leading-[1.5] text-[#607B72]" title={r.authors}>{r.authors}</div>}
                        </td>
                        <td className="text-center font-mono text-muted-green">{r.year}</td>
                        <td><Badge variant={r.status} className="gap-1 whitespace-nowrap capitalize"><StatusIcon status={r.status} />{r.status}</Badge></td>
                        <td className="text-right"><ArrowRight className="ml-auto h-4 w-4 text-[#B9C9C3]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2 className="admin-panel-title"><BarChart3 className="h-4 w-4 text-emerald-brand" /> By Year</h2>
              <Link to="/admin/reports" className="text-[13px] font-semibold text-[#0C765E] transition hover:text-forest">
                All years
              </Link>
            </div>
            <div className="admin-panel-body">
              {(!stats.byYear || stats.byYear.length === 0) && <p className="text-[13.5px] text-muted-green">No data yet</p>}
              <div className="space-y-2">
                {(stats.byYear || []).slice(0, 6).map(y => (
                  <Link
                    key={y.year}
                    to={`/admin/browse?year=${y.year}`}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-soft-green"
                  >
                    <span className="flex h-5 w-9 shrink-0 items-center justify-center rounded-full bg-soft-green font-mono text-[10px] font-bold text-[#0C765E]">{y.year}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6EDE9]">
                      <div className="h-full rounded-full bg-emerald-brand" style={{ width: `${(y.count / maxYearCount) * 100}%` }} />
                    </div>
                    <span className="w-7 shrink-0 text-right font-mono text-[10.5px] font-semibold text-[#0C765E]">{y.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}