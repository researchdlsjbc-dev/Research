import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import Navbar from '../components/Navbar';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.username, form.password, form.full_name);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      <Navbar />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)] relative">
        <div className="absolute -top-32 -right-32 h-96 w-96 blob-shape bg-[#08755B]/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 blob-shape-alt bg-[#C4B5FD]/25 blur-3xl" />
        <div className="absolute inset-0 dot-grid opacity-50" aria-hidden="true" />
        <Card className="w-full max-w-md mx-auto quirk-c card-lift relative">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-xl quirk-a bg-white flex items-center justify-center tilt-r-sm"><img src="/logo.png" alt="De La Salle John Bosco College logo" className="h-8 w-8 object-contain" /></div>
            <span className="font-display font-semibold text-lg gradient-text">ResearchHub</span>
          </div>
          <p className="eyebrow">New member</p>
          <CardTitle className="font-display text-2xl">Create an <span className="gradient-text italic">account</span></CardTitle>
          <CardDescription>Join the research repository</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required placeholder="Your full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required placeholder="Choose a username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={4} placeholder="Min 4 characters" />
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-btn">{loading ? 'Creating...' : 'Create Account'}</Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account? <a href="/login" className="font-semibold text-[#0C765E] hover:underline">Sign In</a>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}