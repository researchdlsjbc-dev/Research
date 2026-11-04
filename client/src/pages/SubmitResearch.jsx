import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Info, BookMarked, FileText, ArrowLeft, Plus, UserPlus, Search, X, Save, Loader2, Paperclip, Upload, FileCheck2, Trash2, KeyRound, Copy, RefreshCw } from 'lucide-react';

export default function SubmitResearch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [selectedAuthorIds, setSelectedAuthorIds] = useState([]);
  const [authorDialogOpen, setAuthorDialogOpen] = useState(false);
  const [authorSearch, setAuthorSearch] = useState('');
  const [newAuthorDialogOpen, setNewAuthorDialogOpen] = useState(false);
  const [newAuthor, setNewAuthor] = useState({ name: '', email: '', affiliation: '', orcid: '' });
  const [creatingAuthor, setCreatingAuthor] = useState(false);
  const [form, setForm] = useState({ title: '', authors: '', adviser: '', program_id: '', year: new Date().getFullYear(), abstract: '', keywords: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('details');
  const [pdfFile, setPdfFile] = useState(null);
  const [existingPdf, setExistingPdf] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [accessCodeUpdatedAt, setAccessCodeUpdatedAt] = useState(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [accessCopied, setAccessCopied] = useState(false);
  const pdfInputRef = useRef(null);
  const isEdit = !!id;

  useEffect(() => {
    axios.get(`${API}/programs/`).then(r => { if (Array.isArray(r.data)) setPrograms(r.data); }).catch(() => {});
    // fetch all authors (paginated)
    const fetchAllAuthors = async () => {
      try {
        let allAuthors = [];
        let page = 1;
        const limit = 200;
        while (true) {
          const res = await axios.get(`${API}/authors/`, { params: { limit, page, sort: 'name' } });
          const data = res.data.data || res.data;
          if (!Array.isArray(data) || data.length === 0) break;
          allAuthors = allAuthors.concat(data);
          if (data.length < limit) break;
          page++;
        }
        setAuthors(allAuthors);
      } catch (e) {}
    };
    fetchAllAuthors();
    if (isEdit) {
      axios.get(`${API}/research/${id}`).then(r => {
        const d = r.data;
        const authorIds = d.author_details?.map(a => a.id) || [];
        setSelectedAuthorIds(authorIds);
        const authorNames = d.author_details?.map(a => a.name).join(', ') || d.authors || '';
        setForm({ title: d.title, authors: authorNames, adviser: d.adviser || '', program_id: d.program_id ? String(d.program_id) : '', year: d.year, abstract: d.abstract || '', keywords: d.keywords || '' });
        setExistingPdf(d.pdf_path ? { file_name: d.pdf_file_name || 'research.pdf', size: d.pdf_size || 0, path: d.pdf_path } : null);
      });
      axios.get(`${API}/research/${id}/pdf/access-code`).then(r => {
        setAccessCode(r.data.code || '');
        setAccessCodeUpdatedAt(r.data.updated_at || null);
      }).catch(err => {
        setAccessError(err.response?.data?.error || 'Unable to load the PDF access code.');
      });
    }
  }, [id]);

  const handleAuthorSelect = (authorId) => {
    setSelectedAuthorIds(prev => {
      const next = prev.includes(authorId) ? prev.filter(id => id !== authorId) : [...prev, authorId];
      const names = authors.filter(a => next.includes(a.id)).map(a => a.name);
      setForm(f => ({ ...f, authors: names.join(', ') }));
      return next;
    });
  };

  const handleCreateAuthor = async (e) => {
    e.preventDefault();
    if (!newAuthor.name.trim()) return;
    setCreatingAuthor(true);
    try {
      const res = await axios.post(`${API}/authors/`, newAuthor);
      setAuthors(prev => [res.data, ...prev]);
      setSelectedAuthorIds(prev => [...prev, res.data.id]);
      setForm(f => ({ ...f, authors: [...authors.filter(a => selectedAuthorIds.includes(a.id)), res.data].map(a => a.name).join(', ') }));
      setNewAuthor({ name: '', email: '', affiliation: '', orcid: '' });
      setNewAuthorDialogOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create author');
    }
    setCreatingAuthor(false);
  };

  const filteredAuthors = authors.filter(a => a.name.toLowerCase().includes(authorSearch.toLowerCase()));

  const formatBytes = (bytes) => {
    const value = Number(bytes) || 0;
    if (!value) return '';
    if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearPdfInput = () => {
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handlePdfSelect = (event) => {
    const file = event.target.files?.[0];
    setPdfError('');
    if (!file) {
      setPdfFile(null);
      return;
    }
    const contentType = String(file.type || '').toLowerCase();
    if (!/\.pdf$/i.test(file.name) || (contentType && contentType !== 'application/pdf' && contentType !== 'application/octet-stream')) {
      setPdfError('Only PDF files are allowed.');
      setPdfFile(null);
      clearPdfInput();
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setPdfError('PDF files must be 50 MB or smaller.');
      setPdfFile(null);
      clearPdfInput();
      return;
    }
    setPdfFile(file);
  };

  const handleRemoveExistingPdf = async () => {
    if (!id) return;
    setPdfBusy(true);
    setPdfError('');
    try {
      await axios.delete(`${API}/research/${id}/pdf`);
      setExistingPdf(null);
    } catch (err) {
      setPdfError(err.response?.data?.error || 'Unable to remove the attached PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleCopyAccessCode = async () => {
    if (!accessCode) return;
    try {
      await navigator.clipboard.writeText(accessCode);
      setAccessCopied(true);
      setTimeout(() => setAccessCopied(false), 1800);
    } catch (err) {
      setAccessError('Unable to copy the access code.');
    }
  };

  const handleRegenerateAccessCode = async () => {
    if (!id || accessBusy) return;
    if (!window.confirm('Generate a new access code? The current code will stop working immediately.')) return;
    setAccessBusy(true);
    setAccessError('');
    try {
      const { data } = await axios.post(`${API}/research/${id}/pdf/access-code/regenerate`);
      setAccessCode(data.code || '');
      setAccessCodeUpdatedAt(data.updated_at || null);
      setAccessCopied(false);
    } catch (err) {
      setAccessError(err.response?.data?.error || 'Unable to regenerate the access code.');
    } finally {
      setAccessBusy(false);
    }
  };

  const uploadPdfToResearch = async (researchId) => {
    const contentType = pdfFile.type || 'application/pdf';
    const { data } = await axios.post(`${API}/research/${researchId}/pdf/upload-url`, {
      file_name: pdfFile.name,
      size: pdfFile.size,
      content_type: contentType
    });
    const uploadResponse = await fetch(data.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: pdfFile
    });
    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text().catch(() => '');
      throw new Error(`Storage upload failed (${uploadResponse.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }
    await axios.post(`${API}/research/${researchId}/pdf`, {
      path: data.path,
      file_name: data.file_name || pdfFile.name,
      size: pdfFile.size,
      content_type: contentType
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...form, author_ids: selectedAuthorIds };
      const { data: saved } = isEdit
        ? await axios.put(`${API}/research/${id}`, payload)
        : await axios.post(`${API}/research/`, payload);
      if (pdfFile) {
        try {
          await uploadPdfToResearch(saved.id);
        } catch (uploadErr) {
          const message = uploadErr.response?.data?.error || uploadErr.message || 'PDF upload failed';
          setPdfError(message);
          setTab('pdf');
          if (!isEdit) {
            setError(`Research saved, but the PDF upload failed: ${message}`);
            setTimeout(() => navigate(`/edit-research/${saved.id}`), 5000);
            return;
          }
          throw new Error(`PDF upload failed: ${message}`);
        }
      }
      setTimeout(() => navigate(isAdmin ? '/admin/research' : '/research'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="admin-eyebrow">
            <BookMarked className="h-3 w-3" />
            Repository Intake
          </span>
          <h1 className="admin-title mt-3">{isEdit ? 'Edit' : 'Submit'} <em>Research</em></h1>
          <p className="admin-subtitle">{isEdit ? 'Update the research record' : 'Submit a new research work to the institutional repository'}</p>
        </div>
        <Button type="button" variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green transition hover:bg-soft-green hover:text-forest" onClick={() => navigate(isAdmin ? '/admin/research' : '/research')}>
          <ArrowLeft className="h-4 w-4" /> Back to Catalog
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="admin-panel overflow-hidden">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title"><FileText className="h-4 w-4 text-emerald-brand" /> Work Details</h2>
          <span className="text-[12px] font-semibold text-muted-green"><span className="text-red-500">*</span> Required fields</span>
        </div>
        <div className="admin-panel-body">
          {error && (
            <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
              {error}
            </div>
          )}
          <Tabs value={isAdmin ? tab : 'details'} onValueChange={setTab} className="w-full">
            {isAdmin && (
              <TabsList className="mb-5 h-auto rounded-full bg-[#EEF5F1] p-1">
                <TabsTrigger value="details" className="rounded-full px-4 py-2 text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:text-forest">
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Work Details
                </TabsTrigger>
                <TabsTrigger value="pdf" className="rounded-full px-4 py-2 text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:text-forest">
                  <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Attach File
                </TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="details" className="mt-0">
          <div className="admin-note mb-6">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-brand" />
            <span>A unique research code (e.g. <strong className="font-mono font-semibold text-[#0C765E]">RS-2026-0001</strong>) will be automatically assigned when submitted.</span>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="Enter the research title" className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="space-y-2">
                <Label>Authors *</Label>
                <Dialog open={authorDialogOpen} onOpenChange={setAuthorDialogOpen}>
                  <DialogTrigger asChild>
                    <div className="relative">
                      <div className="rounded-xl border-[#DCEBE5] bg-ivory px-4 py-2.5 min-h-[44px] flex flex-wrap items-center gap-2">
{selectedAuthorIds.length === 0 ? (
                              <span className="text-[#A3B5AF]">Select authors...</span>
                            ) : (
                              <>
                                {selectedAuthorIds.map(id => {
                                  const author = authors.find(a => a.id === id);
                                  return author ? (
                                    <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-soft-green text-[12px] font-medium text-[#0C765E]">
                                      {author.name}
                                      <button type="button" onClick={() => handleAuthorSelect(id)} className="text-[#0C765E] hover:text-red-500"><X className="h-3 w-3" /></button>
                                    </span>
                                  ) : null;
                                })}
                              </>
                            )}
                      </div>
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8AA79E]" />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[60vh]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center justify-between">
                        Select Authors
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNewAuthorDialogOpen(true)}><Save className="h-3.5 w-3.5" /> Enter</Button>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /> New</Button>
                          </DialogTrigger>
                        </div>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8AA79E]" />
                        <input type="search" value={authorSearch} onChange={e => setAuthorSearch(e.target.value)} placeholder="Search authors..." className="w-full pl-10 pr-4 py-2 rounded-xl border-[#DCEBE5] bg-ivory text-[13.5px] focus-visible:border-emerald-brand" />
                      </div>
                      <div className="max-h-[40vh] overflow-y-auto space-y-2">
                        {filteredAuthors.length === 0 ? (
                          <p className="text-center text-muted-green py-4">No authors found. <Link to="/admin/authors/new" className="text-emerald-brand underline">Create new author</Link></p>
                        ) : (
                          filteredAuthors.map(a => (
                            <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-soft-green transition cursor-pointer">
                              <Checkbox checked={selectedAuthorIds.includes(a.id)} onChange={() => handleAuthorSelect(a.id)} />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-forest truncate">{a.name}</p>
                                <p className="text-[11px] text-muted-green truncate">{a.affiliation || 'No affiliation'}</p>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <p className="text-[11px] text-muted-green">{selectedAuthorIds.length} author{selectedAuthorIds.length !== 1 ? 's' : ''} selected</p>
              </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Program</Label>
                <Select value={form.program_id ? String(form.program_id) : 'none'} onValueChange={v => setForm({...form, program_id: v === 'none' ? '' : v})}>
                  <SelectTrigger className="rounded-xl border-[#DCEBE5] bg-ivory"><SelectValue placeholder="Select program" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Program</SelectItem>
                    {programs.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year *</Label>
                <Select value={String(form.year)} onValueChange={v => setForm({...form, year: parseInt(v)})}>
                  <SelectTrigger className="rounded-xl border-[#DCEBE5] bg-ivory"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input id="keywords" value={form.keywords} onChange={e => setForm({...form, keywords: e.target.value})} placeholder="Comma-separated keywords, e.g. machine learning, education" className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abstract">Abstract</Label>
              <Textarea id="abstract" rows={5} value={form.abstract} onChange={e => setForm({...form, abstract: e.target.value})} placeholder="Enter the research abstract..." className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
          </div>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="pdf" className="mt-0">
                <div className="admin-note mb-6">
                  <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-emerald-brand" />
                  <span>PDF files are kept in the repository's dedicated <strong className="font-mono font-semibold text-[#0C765E]">pdfs</strong> folder.</span>
                </div>
                <div className="rounded-2xl border border-dashed border-[#CFE2DA] bg-ivory/60 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-soft-green text-[#0C765E]">
                    {pdfFile ? <FileCheck2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                  </div>
                  <p className="mt-3 break-words text-[14px] font-semibold text-forest">
                    {pdfFile ? pdfFile.name : existingPdf ? existingPdf.file_name : 'Choose a PDF file'}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-green">
                    {pdfFile
                      ? `${formatBytes(pdfFile.size)} selected · uploaded when you save`
                      : existingPdf
                        ? `${formatBytes(existingPdf.size)}${existingPdf.size ? ' · ' : ''}currently attached`
                        : 'PDF only · up to 50 MB'}
                  </p>
                  <input
                    ref={pdfInputRef}
                    id="pdf-file"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfSelect}
                    className="sr-only"
                  />
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest" onClick={() => pdfInputRef.current?.click()}>
                      <Upload className="h-4 w-4" />
                      {pdfFile ? 'Choose Another PDF' : existingPdf ? 'Replace PDF' : 'Choose PDF'}
                    </Button>
                    {pdfFile && (
                      <Button type="button" variant="ghost" className="rounded-full text-[13px] font-semibold text-muted-green" onClick={() => { setPdfFile(null); clearPdfInput(); }}>
                        <X className="h-4 w-4" /> Clear
                      </Button>
                    )}
                    {existingPdf && !pdfFile && (
                      <Button type="button" variant="outline" className="rounded-full border-red-200 text-[13px] font-semibold text-red-600 hover:bg-red-50" onClick={handleRemoveExistingPdf} disabled={pdfBusy}>
                        {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove
                      </Button>
                    )}
                  </div>
                </div>
                {pdfError && <p className="mt-3 text-[12.5px] font-medium text-red-600">{pdfError}</p>}

                <div className="mt-5 rounded-2xl border border-[#DCEBE5] bg-white/80 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-forest">
                        <KeyRound className="h-4 w-4 text-emerald-brand" /> PDF Access Code
                      </p>
                      <p className="mt-1 text-[12px] text-muted-green">
                        Visitors must enter this code before downloading the complete paper.
                      </p>
                    </div>
                    {accessCode && (
                      <span className="rounded-full bg-soft-green px-3 py-1 font-mono text-[16px] font-bold tracking-wider text-[#0C765E]">
                        {accessCode}
                      </span>
                    )}
                  </div>
                  {id ? (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest" onClick={handleCopyAccessCode} disabled={!accessCode || accessBusy}>
                          <Copy className="h-4 w-4" /> {accessCopied ? 'Copied' : 'Copy Code'}
                        </Button>
                        <Button type="button" variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest" onClick={handleRegenerateAccessCode} disabled={accessBusy}>
                          {accessBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerate
                        </Button>
                      </div>
                      {accessCodeUpdatedAt && (
                        <p className="mt-2 text-[11px] text-muted-green">
                          Last updated {new Date(accessCodeUpdatedAt).toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-3 rounded-xl bg-[#F4F8F6] px-3 py-2 text-[12px] text-muted-green">
                      A unique access code will be generated automatically when this research is saved.
                    </p>
                  )}
                  {accessError && <p className="mt-2 text-[12.5px] font-medium text-red-600">{accessError}</p>}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <div className="mt-7 flex flex-wrap gap-3 border-t border-[#EEF3F0] pt-5">
            <Button type="submit" disabled={loading} className="gradient-btn min-w-40 rounded-full">
              {loading ? 'Saving...' : isEdit ? 'Update Research' : 'Submit Research'}
            </Button>
            <Button type="button" variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green transition hover:bg-soft-green hover:text-forest" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </div>
      </form>

      <Dialog open={newAuthorDialogOpen} onOpenChange={setNewAuthorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Author</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAuthor} className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="new-author-name">Name *</Label>
              <Input id="new-author-name" value={newAuthor.name} onChange={e => setNewAuthor({...newAuthor, name: e.target.value})} required placeholder="Author name" className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-author-email">Email</Label>
              <Input id="new-author-email" type="email" value={newAuthor.email} onChange={e => setNewAuthor({...newAuthor, email: e.target.value})} placeholder="author@example.com" className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-author-affiliation">Affiliation</Label>
              <Input id="new-author-affiliation" value={newAuthor.affiliation} onChange={e => setNewAuthor({...newAuthor, affiliation: e.target.value})} placeholder="Institution/Organization" className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-author-orcid">ORCID</Label>
              <Input id="new-author-orcid" value={newAuthor.orcid} onChange={e => setNewAuthor({...newAuthor, orcid: e.target.value})} placeholder="0000-0000-0000-0000" className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={creatingAuthor || !newAuthor.name.trim()} className="gradient-btn rounded-full flex-1">
                {creatingAuthor ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create & Add'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setNewAuthorDialogOpen(false)} className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green flex-1">Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}