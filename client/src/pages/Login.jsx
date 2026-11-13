import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import Navbar from '../components/Navbar';
import { BookOpen, Search, FolderOpen } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden">
      <Navbar />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)] relative">
        <div className="absolute -top-32 -left-32 h-96 w-96 blob-shape bg-[#08755B]/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 blob-shape-alt bg-[#8FB3A7]/25 blur-3xl" />
        <div className="absolute inset-0 dot-grid opacity-50" aria-hidden="true" />
        <div className="relative grid md:grid-cols-2 gap-8 max-w-5xl w-full items-center">
        <div className="hidden md:block">
          <p className="eyebrow mb-3">Sign in</p>
          <h1 className="headline-xl text-5xl mb-4">
            Welcome to the <span className="gradient-text italic">archive.</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-md">
            Centralized repository for the campus research works.
          </p>
          <div className="space-y-4">
            {[['BookOpen', 'Research Repository', 'Browse the campus research collection'], ['FolderOpen', 'Unique Cataloging', 'Auto-assigned RS codes for every work'], ['Search', 'Smart Search', 'Filter by program, year, or keywords']].map(([icon, title, desc], i) => {
              const Icon = icon === 'BookOpen' ? BookOpen : icon === 'FolderOpen' ? FolderOpen : Search;
              return (
                <div key={title} className={`flex items-start gap-4 p-4 rounded-2xl ${i % 2 ? 'quirk-b' : 'quirk-a'} glass card-lift`}>
                  <div className="h-9 w-9 rounded-xl bg-[#08755B]/15 text-[#0C765E] flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></div>
                  <div><p className="font-display font-semibold text-base">{title}</p><p className="text-sm text-muted-foreground">{desc}</p></div>
                </div>
              );
            })}
          </div>
        </div>
        <Card className="w-full max-w-md mx-auto quirk-c card-lift">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 md:hidden mb-2">
              <span className="font-display font-semibold text-lg gradient-text">ResearchHub</span>
            </div>
            <p className="eyebrow">Member access</p>
            <CardTitle className="font-display text-2xl">Welcome <span className="gradient-text italic">back</span></CardTitle>
            <CardDescription>Sign in to access the research repository</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Enter your username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter your password" />
              </div>
              <Button type="submit" disabled={loading} className="w-full gradient-btn">{loading ? 'Signing in...' : 'Sign In'}</Button>
            </form>
            <div className="mt-5 text-center text-sm text-muted-foreground">
              Don't have an account? <a href="/register" className="font-semibold text-[#0C765E] hover:underline">Register</a>
            </div>
            <div className="mt-4 text-center text-xs text-muted-foreground bg-white/70 rounded-2xl quirk-b py-2.5 border border-border font-mono">
              Demo admin: <strong className="text-[#0C765E]">admin</strong> / <strong className="text-[#0C765E]">admin123</strong>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}