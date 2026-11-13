import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Facebook, Twitter, Youtube } from 'lucide-react';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/research', label: 'Browse Research' },
  { to: '/about', label: 'About' },
];

const socials = [
  { href: 'https://facebook.com', label: 'Facebook', Icon: Facebook },
  { href: 'https://x.com', label: 'X', Icon: Twitter },
  { href: 'https://youtube.com', label: 'YouTube', Icon: Youtube },
];

const legal = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
];

export default function Footer() {
  const navClass = ({ isActive }) => (isActive ? 'active' : '');

  return (
    <footer
      className="relative mt-10 pb-7 pt-16 text-[#F5F8F2]"
      style={{ background: '#075744' }}
    >
      <div className="container-page relative z-10">
        <div className="flex flex-col items-center justify-between gap-7 border-b border-white/10 pb-8 lg:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <img
                src="/logo.png"
                alt="De La Salle John Bosco College logo"
                className="h-10 w-10 object-contain"
              />
            </span>
            <div>
              <div className="footer-brand-name">ResearchHub</div>
              <p className="footer-brand-subtitle">Research. Discover. Make an Impact.</p>
            </div>
          </div>

          <nav className="footer-nav flex flex-wrap items-center justify-center gap-5 lg:gap-7">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            {socials.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/20"
              >
                <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-[12.5px] sm:flex-row">
          <p className="footer-copy">&copy; {new Date().getFullYear()} ResearchHub. All rights reserved.</p>
          <div className="flex gap-5">
            {legal.map(l => (
              <Link key={l.to} to={l.to} className="footer-legal">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
