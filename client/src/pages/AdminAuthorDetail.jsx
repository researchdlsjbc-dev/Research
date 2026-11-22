import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { ArrowLeft, Mail, Building2, Award, BookOpen, Calendar, Users, TrendingUp, Edit, MoreHorizontal, CheckCircle2, Clock, FolderTree, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

export default function AdminAuthorDetail() {
  const { id } = useParams();
  const [author, setAuthor] = useState(null);
  const [research, setResearch] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('publications');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${API}/authors/${id}`),
      axios.get(`${API}/authors/${id}/stats`)
    ]).then(([authorRes, statsRes]) => {
      if (cancelled) return;
      setAuthor(authorRes.data);
      setResearch(authorRes.data.research || []);
      setStats(statsRes.data);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="admin-page flex items-center justify-center min-h-[400px]">Loading...</div>;
  if (!author) return <div className="admin-page text-center py-12">Author not found</div>;

  const maxYear = Math.max(1, ...(stats?.by_year || []).map(y => y.count));
  const maxProgram = Math.max(1, ...(stats?.by_program || []).map(p => p.count));

  return (
    <div className="admin-page space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/authors"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        <div className="flex-1">
          <span className="admin-eyebrow"><Users className="h-3 w-3" /> Author Profile</span>
          <h1 className="admin-title mt-3">{author.name}</h1>
          <p className="admin-subtitle">Author profile &amp; publications</p>
        </div>
        <Link to={`/admin/authors/${id}/edit`}><Button variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green transition hover:bg-soft-green hover:text-forest"><Edit className="h-4 w-4" /> Edit</Button></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="admin-panel min-w-0 lg:col-span-1 lg:self-start">
          <div className="admin-panel-body flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-brand text-3xl font-bold text-white ring-4 ring-soft-green">
              {author.name.charAt(0).toUpperCase()}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-forest">{author.name}</h3>
            {author.affiliation && <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-green"><Building2 className="h-3.5 w-3.5" /> {author.affiliation}</p>}
            {author.email && <a href={`mailto:${author.email}`} className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-green hover:text-forest"><Mail className="h-3.5 w-3.5" /> {author.email}</a>}
            {author.orcid && <a href={`https://orcid.org/${author.orcid}`} target="_blank" rel="noopener" className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-green hover:text-forest"><Award className="h-3.5 w-3.5" /> ORCID: {author.orcid}</a>}
            {!author.affiliation && !author.email && !author.orcid && (
              <p className="mt-2 text-[12.5px] italic text-[#8AA79E]">No contact details on file</p>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="admin-stat">
              <span className="admin-stat-chip bg-soft-green text-emerald-brand"><BookOpen className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="admin-stat-value">{stats?.total_publications || 0}</p><p className="admin-stat-label">Total Publications</p></div>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-chip bg-soft-green text-emerald-brand"><CheckCircle2 className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="admin-stat-value">{stats?.approved || 0}</p><p className="admin-stat-label">Approved</p></div>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-chip bg-amber-50 text-amber-700"><Clock className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="admin-stat-value">{stats?.pending || 0}</p><p className="admin-stat-label">Pending</p></div>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-chip bg-soft-green text-emerald-brand"><FolderTree className="h-4 w-4" /></span>
              <div className="min-w-0"><p className="admin-stat-value">{stats?.programs_count || 0}</p><p className="admin-stat-label">Programs</p></div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="inline-flex w-fit flex-wrap gap-1.5 rounded-full border border-[#E6EDE9] bg-white p-1.5">
              <TabsTrigger value="publications" className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-muted-green transition data-[state=active]:bg-emerald-brand data-[state=active]:text-white">Publications ({research.length})</TabsTrigger>
              <TabsTrigger value="stats" className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-muted-green transition data-[state=active]:bg-emerald-brand data-[state=active]:text-white">Statistics</TabsTrigger>
            </TabsList>

            <TabsContent value="publications" className="admin-panel mt-5">
              <div className="admin-panel-head">
                <h2 className="admin-panel-title"><BookOpen className="h-4 w-4 text-emerald-brand" /> Publications</h2>
                <span className="text-[13px] font-semibold text-muted-green">{research.length} {research.length === 1 ? 'work' : 'works'}</span>
              </div>
              {research.length === 0 ? (
                <div className="py-14 text-center">
                  <BookOpen className="mx-auto mb-4 h-12 w-12 text-[#8AA79E]" />
                  <h3 className="section-title text-[22px]">No publications yet</h3>
                </div>
              ) : (
                <div className="table-scroll">
                <table className="admin-table w-full table-fixed min-w-[700px] border-collapse">
                  <thead>
                    <tr>
                      <th style={{ width: 300 }}>Title</th>
                      <th style={{ width: 170 }}>Program</th>
                      <th className="text-center" style={{ width: 56 }}>Year</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 64 }} aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {research.map(r => (
                      <tr key={r.id}>
                        <td><Link to={`/admin/research/${r.id}`} className="block truncate text-[14px] font-semibold leading-[1.4] text-forest hover:underline" title={r.title}>{r.title}</Link></td>
                        <td><span className="block truncate text-[13px] leading-[1.5] text-[#55736C]" title={r.program_name || undefined}>{r.program_name || <span className="text-[#A3B5AF]">—</span>}</span></td>
                        <td className="text-center font-mono text-muted-green">{r.year}</td>
                        <td><Badge variant={r.status} className="whitespace-nowrap capitalize">{r.status}</Badge></td>
                        <td className="text-right"><Link to={`/admin/research/${r.id}`} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-muted-green hover:bg-soft-green hover:text-forest" title="View"><MoreHorizontal className="h-4 w-4" /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="stats" className="mt-5 space-y-5">
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="admin-stat">
                  <span className="admin-stat-chip bg-soft-green text-emerald-brand"><Calendar className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="admin-stat-value">{stats?.years_active || 0}</p><p className="admin-stat-label">Years Active</p></div>
                </div>
                <div className="admin-stat">
                  <span className="admin-stat-chip bg-soft-green text-emerald-brand"><TrendingUp className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="admin-stat-value">{stats?.first_year || '—'}</p><p className="admin-stat-label">First Publication</p></div>
                </div>
                <div className="admin-stat">
                  <span className="admin-stat-chip bg-soft-green text-emerald-brand"><Award className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="admin-stat-value">{stats?.latest_year || '—'}</p><p className="admin-stat-label">Latest Publication</p></div>
                </div>
                <div className="admin-stat">
                  <span className="admin-stat-chip bg-red-50 text-red-600"><XCircle className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="admin-stat-value">{stats?.rejected || 0}</p><p className="admin-stat-label">Rejected</p></div>
                </div>
              </div>

              {Boolean(stats?.by_year?.length || stats?.by_program?.length) && (
                <div className="grid gap-5 lg:grid-cols-2">
                  {stats.by_year?.length > 0 && (
                    <div className="admin-panel">
                      <div className="admin-panel-head">
                        <h2 className="admin-panel-title"><Calendar className="h-4 w-4 text-emerald-brand" /> Publications by Year</h2>
                      </div>
                      <div className="admin-panel-body">
                        <div className="space-y-2">
                          {stats.by_year.map(y => (
                            <Link key={y.year} to={`/admin/browse?year=${y.year}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-soft-green">
                              <span className="flex h-6 w-12 shrink-0 items-center justify-center rounded-full bg-soft-green font-mono text-[11px] font-bold text-[#0C765E]">{y.year}</span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6EDE9]">
                                <div className="h-full rounded-full bg-emerald-brand" style={{ width: `${(y.count / maxYear) * 100}%` }} />
                              </div>
                              <span className="w-8 shrink-0 text-right font-mono text-[11.5px] font-semibold text-[#0C765E]">{y.count}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {stats.by_program?.length > 0 && (
                    <div className="admin-panel">
                      <div className="admin-panel-head">
                        <h2 className="admin-panel-title"><FolderTree className="h-4 w-4 text-emerald-brand" /> Publications by Program</h2>
                      </div>
                      <div className="admin-panel-body">
                        <div className="space-y-2">
                          {stats.by_program.map(p => (
                            <Link key={p.code} to={`/admin/browse?program=${encodeURIComponent(p.code)}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-soft-green">
                              <span className="w-36 shrink-0 truncate text-[12.5px] font-semibold text-[#3F635A]" title={p.name}>{p.name}</span>
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E6EDE9]">
                                <div className="h-full rounded-full bg-emerald-brand" style={{ width: `${(p.count / maxProgram) * 100}%` }} />
                              </div>
                              <span className="w-8 shrink-0 text-right font-mono text-[11.5px] font-semibold text-[#0C765E]">{p.count}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}