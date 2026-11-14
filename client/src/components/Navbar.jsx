import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, Search, LogOut, ChevronRight } from 'lucide-react';

const publicItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/research', label: 'Browse Research' },
  { to: '/about', label: 'About' },
];

const authItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/submit', label: 'Submit Research' },
];

const adminItems = [
  { to: '/admin/research', label: 'Manage Research' },
  { to: '/admin/users', label: 'Manage Users' },
  { to: '/admin/programs', label: 'Manage Programs' },
];

const navLinkClass = ({ isActive }) =>
  `nav-link${isActive ? ' is-active' : ''}`;

const menuLinkClass = ({ isActive }) =>
  `flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition ${
    isActive ? 'bg-emerald-brand text-white' : 'text-muted-green hover:bg-soft-green hover:text-forest'
  }`;

export default function Navbar() {
  const { token, user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const navigate = useNavigate();

  const close = () => setOpen(false);

  const handleLogout = () => {
    logout();
    close();
    navigate('/');
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const q = term.trim();
    close();
    navigate(q ? `/research?q=${encodeURIComponent(q)}` : '/research');
  };

  const searchField = (
    <form onSubmit={submitSearch} className="relative ml-auto w-[200px] sm:w-[250px] lg:w-[320px]">
      <label htmlFor="site-search" className="sr-only">Search research</label>
      <input
        id="site-search"
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search research, authors, keywords..."
        className="header-search"
      />
      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-brand pointer-events-none">
        <Search className="h-[18px] w-[18px]" />
      </span>
    </form>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[#E6EDE9] bg-ivory/95 backdrop-blur">
      <div className="container-page grid h-[60px] grid-cols-[1fr_auto] items-center gap-4 md:grid-cols-[1fr_auto_1fr] lg:gap-8">
        {/* Brand */}
        <NavLink to="/" onClick={close} className="flex shrink-0 items-center gap-3 justify-self-start">
          <img
            src="/logo.png"
            alt="De La Salle John Bosco College logo"
            className="h-10 w-10 shrink-0 object-contain"
          />
          <span className="font-display text-[30px] font-bold leading-none tracking-[-0.02em] text-[#123F38]">
            ResearchHub
          </span>
        </NavLink>

        {/* Nav */}
        <nav className="hidden items-center gap-8 justify-self-center md:flex">
          {publicItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
          {token && (
            <>
              {authItems.map(item => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
              {isAdmin && adminItems.map(item => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Account + search */}
        <div className="col-start-2 flex w-full shrink-0 items-center justify-end gap-3 md:col-start-3">
          {token ? (
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <div className="text-right leading-tight">
                <p className="max-w-[140px] truncate text-[12.5px] font-semibold text-forest">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-green">
                  {isAdmin ? 'Administrator' : 'Member'}
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-brand text-[13px] font-bold text-white">
                {(user?.full_name || 'U').charAt(0).toUpperCase()}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DCEBE5] text-muted-green transition hover:border-[#B9D4CA] hover:bg-soft-green hover:text-forest"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="hidden shrink-0 md:block">{searchField}</div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DCEBE5] text-forest transition hover:bg-soft-green md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#E6EDE9] bg-ivory px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {publicItems.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={close} className={menuLinkClass}>
                {item.label}
                <ChevronRight className="h-4 w-4 opacity-50" />
              </NavLink>
            ))}
            {token && (
              <>
                {authItems.map(item => (
                  <NavLink key={item.to} to={item.to} onClick={close} className={menuLinkClass}>
                    {item.label}
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </NavLink>
                ))}
                {isAdmin && adminItems.map(item => (
                  <NavLink key={item.to} to={item.to} onClick={close} className={menuLinkClass}>
                    {item.label}
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </NavLink>
                ))}
              </>
            )}
          </nav>

          <div className="mt-4">{searchField}</div>

          {token && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E6EDE9] pt-4">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-forest">{user?.full_name || 'User'}</p>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-green">
                  {isAdmin ? 'Administrator' : 'Member'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-[#DCEBE5] px-3.5 py-2 text-[12.5px] font-semibold text-forest transition hover:bg-soft-green"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}