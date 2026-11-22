import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import BookOpening from '../components/BookOpening';
import LockedAbstract from '../components/LockedAbstract';
import { ArrowLeft, Users, Award, FolderTree, Calendar, FileText, Tags, CheckCircle2, XCircle, BookOpen, Share2, Bookmark, ExternalLink, ChevronDown, ChevronUp, KeyRound, Loader2 } from 'lucide-react';

const rowMeta = {
  adviser: { icon: Award, tint: 'bg-amber-100 text-amber-700' },
  program: { icon: FolderTree, tint: 'bg-[#08755B]/15 text-[#0C765E]' },
  year: { icon: Calendar, tint: 'bg-sky-100 text-sky-700' },
  code: { icon: FileText, tint: 'bg-orange-100 text-orange-700' },
};

const statusConfig = {
  approved: { label: 'Approved', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending Review', class: 'bg-amber-100 text-amber-700 border-amber-200' },
  rejected: { label: 'Rejected', class: 'bg-red-100 text-red-700 border-red-200' },
  draft: { label: 'Draft', class: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function ResearchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [research, setResearch] = useState(null);
  const [opening, setOpening] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [accessLoading, setAccessLoading] = useState(false);

  const accessStorageKey = `pdf_access_code_${id}`;

  useEffect(() => {
    axios.get(`${API}/research/${id}`).then(r => setResearch(r.data)).catch(() => navigate('/'));
  }, [id, navigate]);

  useEffect(() => {
    setOpening(true);
    setReveal(false);
    const t1 = setTimeout(() => setReveal(true), 2100);
    const t2 = setTimeout(() => setOpening(false), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [id]);

  if (!research) return <div className="flex items-center justify-center h-64"><div className="text-lg font-semibold gradient-text">Loading...</div></div>;

  const keywords = research.keywords ? research.keywords.split(',').map(k => k.trim()).filter(Boolean) : [];
  const authors = research.authors ? research.authors.split(',').map(a => a.trim()).filter(Boolean) : [];
  const authorDetails = research.author_details || [];
  const statusInfo = statusConfig[research.status] || statusConfig.pending;

  const detailRows = [
    { key: 'code', label: 'Research Code', value: research.code },
    { key: 'adviser', label: 'Adviser', value: research.adviser || 'N/A' },
    { key: 'program', label: 'Program', value: research.program_name ? `${research.program_name} (${research.program_code})` : 'N/A' },
    { key: 'year', label: 'Year', value: research.year },
  ];

  const triggerView = (data) => {
    if (!data?.url) throw new Error('No view link was returned.');
    window.open(data.url, '_blank', 'noopener');
  };

  const handleView = async () => {
    if (!research.pdf_path) return;
    // Every view requires a valid access code — no admin bypass, no saved-code shortcut.
    setAccessError('');
    setAccessCode('');
    setAccessOpen(true);
  };

  const handleAccessSubmit = async (event) => {
    event.preventDefault();
    setAccessLoading(true);
    setAccessError('');
    try {
      const { data } = await axios.post(`${API}/research/${id}/pdf/access`, { code: accessCode });
      sessionStorage.setItem(accessStorageKey, accessCode);
      triggerView(data);
      setAccessOpen(false);
      setAccessCode('');
    } catch (error) {
      setAccessError(error.response?.data?.error || 'Invalid access code.');
    } finally {
      setAccessLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: research.title,
          text: research.abstract?.substring(0, 200) + '...',
          url: window.location.href,
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <>
      {opening && <BookOpening title={research.title} authors={authors.join(', ')} type={research.type} />}

      <div
        className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10 space-y-6"
        style={{
          opacity: reveal ? 1 : 0,
          transform: reveal ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}
      >
        {/* Header with back button and actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <Button variant="ghost" className="rounded-full gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Catalog</span>
          </Button>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full active:bg-emerald-50/50"
              onClick={handleShare}
              aria-label="Share research"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {research.pdf_path && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-full active:bg-emerald-50/50"
                onClick={handleView}
                aria-label="View PDF"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="rounded-full active:bg-emerald-50/50"
              onClick={() => setIsBookmarked(!isBookmarked)}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark research'}
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-emerald-600 text-emerald-600' : ''}`} />
            </Button>
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2 ml-2 border-l border-border pl-2 w-full sm:w-auto">
                {research.status !== 'approved' && (
                  <Button className="gradient-btn rounded-full gap-2 w-full sm:w-auto" onClick={() => { axios.patch(`${API}/research/${id}/status`, { status: 'approved' }).then(r => setResearch(r.data)); }}>
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                )}
                {research.status !== 'rejected' && (
                  <Button variant="destructive" className="rounded-full gap-2 w-full sm:w-auto" onClick={() => { axios.patch(`${API}/research/${id}/status`, { status: 'rejected' }).then(r => setResearch(r.data)); }}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Card */}
        <Card className="quirk-c overflow-hidden bg-white/95 backdrop-blur-sm border-border/50 shadow-xl">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-[#08755B] via-[#0C765E] to-[#8FB3A7]" />

          <CardHeader className="pb-5 px-4 sm:px-6 pt-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge className={`capitalize border px-3 py-1.5 text-xs font-medium ${statusInfo.class}`}>
                {statusInfo.label}
              </Badge>
              <span className="code-tag sticker bg-[#0A3B2E] text-[#BFE0D3] -rotate-2 font-mono text-xs">
                {research.code}
              </span>
              {research.type && (
                <Badge variant="outline" className="text-xs border-border/50">
                  {research.type}
                </Badge>
              )}
            </div>

            <p className="eyebrow mb-2">Catalogued Research Work</p>
            <CardTitle className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight text-[#103F37]">
              {research.title}
            </CardTitle>

            {/* Authors */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[#607B72]">By</span>
              <div className="flex flex-wrap gap-2">
                {authorDetails.length > 0 ? (
                  authorDetails.map((ad, i) => (
                    <Link key={ad.id} to={`/author/${ad.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 border border-border shadow-sm text-sm font-medium hover:bg-soft-green active:bg-soft-green active:text-forest transition">
                      <span className="h-5 w-5 rounded-full bg-[#08755B]/20 text-[#0C765E] flex items-center justify-center text-[10px] font-bold font-mono">
                        {ad.name.charAt(0).toUpperCase()}
                      </span>
                      {ad.name}
                    </Link>
                  ))
                ) : (
                  authors.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 border border-border shadow-sm text-sm font-medium active:bg-soft-green active:text-forest transition">
                      <span className="h-5 w-5 rounded-full bg-[#08755B]/20 text-[#0C765E] flex items-center justify-center text-[10px] font-bold font-mono">
                        {a.charAt(0).toUpperCase()}
                      </span>
                      {a}
                    </span>
                  ))
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-6">
            {/* Metadata Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {detailRows.map((row, i) => {
                const meta = rowMeta[row.key] || { icon: FileText, tint: 'bg-[#08755B]/15 text-[#0C765E]' };
                const Icon = meta.icon;
                return (
                  <div
                    key={row.key}
                    className={`flex items-start gap-2 p-3 sm:p-4 rounded-2xl border border-border/50 transition hover:border-emerald-200 hover:bg-emerald-50/50 active:border-emerald-200 active:bg-emerald-50/50 ${i % 2 ? 'bg-white/50' : 'bg-[#FAFCFB]'}`}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta.tint}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{row.label}</p>
                      <p className="text-sm font-semibold text-foreground font-mono truncate">{row.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Keywords */}
            {keywords.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Tags className="h-4 w-4" /> Keywords
                  </p>
                  <span className="text-xs text-muted-foreground">{keywords.length} tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-full bg-[#08755B]/10 text-[#0C765E] text-xs font-medium border border-[#08755B]/20 hover:bg-[#08755B]/20 transition"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Abstract Section */}
            {research.abstract && (
              <div className="pt-4 border-t border-border/50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-between gap-3 sm:gap-0 mb-4">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <BookOpen className="h-4 w-4" /> Abstract
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs sm:text-sm font-medium w-full sm:w-auto"
                    onClick={() => setShowFullAbstract(!showFullAbstract)}
                  >
                    {showFullAbstract ? (
                      <>Show Less <ChevronUp className="h-3.5 w-3.5" /></>
                    ) : (
                      <>Read More <ChevronDown className="h-3.5 w-3.5" /></>
                    )}
                  </Button>
                </div>
                <LockedAbstract text={research.abstract} maxLines={showFullAbstract ? 999 : 4} />
              </div>
            )}

            {/* Additional Info Section */}
            {(research.doi || research.publication_venue || research.funding_source || research.pages || research.doi) && (
              <div className="pt-4 border-t border-border/50">
                <p className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Additional Information
                </p>
                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                  {research.doi && (
                    <div className="p-3 sm:p-4 rounded-2xl bg-white/50 border border-border/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">DOI</p>
                      <a href={`https://doi.org/${research.doi}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-700 flex items-center gap-1.5 hover:underline active:text-emerald-600">
                        {research.doi}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                  {research.publication_venue && (
                    <div className="p-3 sm:p-4 rounded-2xl bg-white/50 border border-border/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Publication Venue</p>
                      <p className="text-sm font-medium text-foreground">{research.publication_venue}</p>
                    </div>
                  )}
                  {research.funding_source && (
                    <div className="p-3 sm:p-4 rounded-2xl bg-white/50 border border-border/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Funding Source</p>
                      <p className="text-sm font-medium text-foreground">{research.funding_source}</p>
                    </div>
                  )}
                  {research.pages && (
                    <div className="p-3 sm:p-4 rounded-2xl bg-white/50 border border-border/50">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pages</p>
                      <p className="text-sm font-medium text-foreground">{research.pages}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-between gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Added {new Date(research.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                {research.updated_at && research.updated_at !== research.created_at && (
                  <span className="flex items-center gap-1.5">
                    <ChevronDown className="h-3.5 w-3.5" /> Updated {new Date(research.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2 w-full sm:w-auto">
                <Button variant="outline" className="rounded-full gap-2 w-full sm:w-auto" onClick={handleShare}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                {research.pdf_path && (
                  <Button variant="outline" className="rounded-full gap-2 w-full sm:w-auto" onClick={handleView}>
                    <ExternalLink className="h-4 w-4" /> View
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Related Research - placeholder for future enhancement */}
        {/* <RelatedResearch programCode={research.program_code} currentId={id} /> */}
      </div>

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#0C765E]" /> Enter Access Code
            </DialogTitle>
            <DialogDescription>
              This complete paper is protected. Enter the access code provided with the research to view the PDF.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAccessSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-access-code">Access code</Label>
              <Input
                id="pdf-access-code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="ABCD-EFGH"
                autoComplete="off"
                autoFocus
                className="rounded-xl border-[#DCEBE5] bg-ivory text-center font-mono text-base uppercase tracking-wider"
              />
            </div>
            {accessError && <p className="text-[12.5px] font-medium text-red-600">{accessError}</p>}
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button type="submit" disabled={accessLoading || !accessCode.trim()} className="gradient-btn flex-1 rounded-full w-full sm:w-auto">
                {accessLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} View PDF
              </Button>
              <Button type="button" variant="outline" className="rounded-full border-[#DCEBE5] w-full sm:w-auto" onClick={() => setAccessOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}