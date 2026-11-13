import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { LayoutDashboard, Upload, Users, FolderTree, BookMarked, LogOut, X, Search, User, HardDrive } from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/submit', label: 'Submit Research', icon: Upload },
];

const adminItems = [
  { to: '/admin/research', label: 'Manage Research', icon: BookMarked },
  { to: '/admin/browse', label: 'Browse Research', icon: Search },
  { to: '/admin/authors', label: 'Manage Authors', icon: User },
  { to: '/admin/users', label: 'Manage Users', icon: Users },
  { to: '/admin/backups', label: 'Backup & Recovery', icon: HardDrive },
  { to: '/admin/programs', label: 'Manage Programs', icon: FolderTree },
];

const itemClass = ({ isActive }) =>
  `admin-nav-link${isActive ? ' is-active' : ''}`;

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleNav = () => onClose();

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/');
  };

  const inner = (
    <div className="flex h-full w-64 flex-col border-r border-[#E6EDE9] bg-ivory">
      <div className="flex items-center justify-between border-b border-[#E6EDE9] px-5 py-[18px]">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="De La Salle John Bosco College logo"
            className="h-10 w-10 shrink-0 object-contain"
          />
          <div>
            <h2 className="font-display text-[17px] font-semibold leading-tight text-forest">ResearchHub</h2>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#176653]">Admin Panel</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close navigation" className="rounded-lg p-1.5 text-muted-green transition hover:bg-soft-green hover:text-forest md:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="admin-nav-section">Workspace</p>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} onClick={handleNav} className={itemClass}>
            <item.icon className="h-4 w-4 shrink-0" />{item.label}
          </NavLink>
        ))}
        <p className="admin-nav-section">Administration</p>
        {adminItems.map(item => (
          <NavLink key={item.to} to={item.to} onClick={handleNav} className={itemClass}>
            <item.icon className="h-4 w-4 shrink-0" />{item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#E6EDE9] p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-soft-green text-[13px] font-bold text-[#0C765E]">
            {(user?.full_name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-forest">{user?.full_name || 'User'}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8AA79E]">Administrator</p>
          </div>
        </div>
        <Button variant="outline" className="w-full rounded-full border-[#DCEBE5] bg-white text-[13px] font-semibold text-muted-green transition hover:border-[#CFE2DA] hover:bg-soft-green hover:text-forest" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-[#062A22]/45 transition-opacity md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={handleNav} />
      <div className={`fixed bottom-0 left-0 top-0 z-50 transition-transform duration-200 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {inner}
      </div>
    </>
  );
}