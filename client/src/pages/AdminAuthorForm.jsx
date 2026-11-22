import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { ArrowLeft, User, Mail, Building2, Award, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function AdminAuthorForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ name: '', email: '', affiliation: '', orcid: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      axios.get(`${API}/authors/${id}`).then(r => {
        setForm({ name: r.data.name, email: r.data.email || '', affiliation: r.data.affiliation || '', orcid: r.data.orcid || '' });
      }).catch(() => navigate('/admin/authors'));
    }
  }, [id, isEdit, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit) {
        await axios.patch(`${API}/authors/${id}`, form);
      } else {
        await axios.post(`${API}/authors/`, form);
      }
      navigate('/admin/authors');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save author');
      setLoading(false);
    }
  };

  return (
    <div className="admin-page max-w-2xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="admin-eyebrow"><User className="h-3 w-3" /> Authors</span>
          <h1 className="admin-title mt-3">{isEdit ? <>Edit <em>Author</em></> : <>New <em>Author</em></>}</h1>
          <p className="admin-subtitle">{isEdit ? 'Update author information' : 'Add a new author to the catalog'}</p>
        </div>
        <Link to="/admin/authors"><Button variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green transition hover:bg-soft-green hover:text-forest"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title"><User className="h-4 w-4 text-emerald-brand" /> Author Information</h2>
        </div>
        <div className="admin-panel-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g., Juan Dela Cruz" className="mt-1.5 rounded-xl border-[#DCEBE5] bg-ivory" required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="juan@university.edu" className="mt-1.5 rounded-xl border-[#DCEBE5] bg-ivory" />
              </div>
              <div>
                <Label htmlFor="affiliation">Affiliation</Label>
                <Input id="affiliation" value={form.affiliation} onChange={e => setForm({...form, affiliation: e.target.value})} placeholder="University/Institution" className="mt-1.5 rounded-xl border-[#DCEBE5] bg-ivory" />
              </div>
              <div>
                <Label htmlFor="orcid">ORCID</Label>
                <Input id="orcid" value={form.orcid} onChange={e => setForm({...form, orcid: e.target.value})} placeholder="0000-0000-0000-0000" className="mt-1.5 rounded-xl border-[#DCEBE5] bg-ivory" />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E6EDE9] pt-4">
              <Link to="/admin/authors"><Button type="button" variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green transition hover:bg-soft-green hover:text-forest">Cancel</Button></Link>
              <Button type="submit" disabled={loading} className="gradient-btn rounded-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEdit ? 'Update' : 'Create')} Author
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}