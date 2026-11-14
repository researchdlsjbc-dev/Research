import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { BookOpen, CheckCircle2, Clock, XCircle, Users, FolderTree, ArrowRight, FileText, LayoutDashboard, BarChart3 } from 'lucide-react';

const StatusIcon = ({ status }) => {
  const map = { approved: CheckCircle2, pending: Clock, rejected: XCircle };
  const Icon = map[status] || Clock;
  return <Icon className="h-3.5 w-3.5" />;
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    axios.get(`${API}/stats/`).then(r => { if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) setStats(r.data); }).catch(() => {});
    axios.get(`${API}/research/?limit=5`).then(r => { if (Array.isArray(r.data?.data)) setRecent(r.data.data); }).catch(() => {});
  }, []);

  if (!stats) return <div className="flex h-64 items-center justify-center"><div className="text-[15px] font-semibold text-muted-green">Loading...</div></div>;

  const statCards = [
    { label: 'Total Research', value: stats.total, icon: BookOpen, chip: 'bg-soft-green text-emerald-brand' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, chip: 'bg-soft-green text-emerald-brand' },
    { label: 'Pending', value: stats.pending, icon: Clock, chip: 'bg-amber-50 text-amber-700' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, chip: 'bg-red-50 text-red-600' },
    { label: 'Users', value: stats.users, icon: Users, chip: 'bg-pale-green text-[#0C765E]' },
    { label: 'Programs', value: stats.programs, icon: FolderTree, chip: 'bg-mint-dark text-deep-green' },
  ];

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
            <div key={s.label} className="admin-stat">
              <span className={`admin-stat-chip ${s.chip}`}>
                <s.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="admin-stat-value">{s.value}</p>
                <p className="admin-stat-label">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="admin-panel lg:col-span-2">
            <div className="admin-panel-head">
              <h2 className="admin-panel-title"><FileText className="h-4 w-4 text-emerald-brand" /> Recent Submissions</h2>
              <Link to="/research" className="text-[13px] font-semibold text-[#0C765E] transition hover:text-forest">
                View All
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="px-6 py-14 text-center text-muted-green">
                <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-35" />
                <p className="text-[13.5px]">No submissions yet</p>
              </div>
            ) : (
              <Table className="admin-table">
                <TableHeader>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map(r => (
                    <TableRow key={r.id} className="cursor-pointer border-0" onClick={() => window.location.href = `/research/${r.id}`}>
                      <TableCell className="font-mono text-[12px] font-semibold text-[#0C765E]">{r.code}</TableCell>
                      <TableCell className="font-medium text-forest">{r.title}</TableCell>
                      <TableCell>
                        <Badge variant={r.status} className="gap-1 capitalize"><StatusIcon status={r.status} />{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2 className="admin-panel-title"><BarChart3 className="h-4 w-4 text-emerald-brand" /> By Year</h2>
            </div>
            <div className="admin-panel-body">
              {(!stats.byYear || stats.byYear.length === 0) && <p className="text-[13.5px] text-muted-green">No data yet</p>}
              <div className="space-y-1">
                {(stats.byYear || []).slice(0, 6).map(y => (
                  <div key={y.year} className="flex items-center justify-between rounded-lg px-2 py-2 transition hover:bg-pale-green">
                    <span className="font-mono text-[13px] font-semibold text-forest">{y.year}</span>
                    <Badge variant="secondary" className="bg-soft-green text-[#0C765E] hover:bg-mint-dark">{y.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}