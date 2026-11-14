import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import {
  Landmark, ArrowRight, Search, BarChart3, FolderOpen, ShieldCheck,
  Mail, MapPin, GraduationCap, Quote,
} from 'lucide-react';

const served = [
  'Students, faculty, staff, and institutional users across every program and year level.',
  'Faculty members and academic users submitting, reviewing, and citing institutional research.',
  'Researchers and research teams looking for prior work, datasets, and published findings.',
  'Supporting academic communities, librarians, and partner institutions building on shared knowledge.',
];

const features = [
  { icon: Search, title: 'Easy Search', copy: 'Efficient search and discovery across titles, authors, keywords, and full text.' },
  { icon: BarChart3, title: 'Usage Analytics', copy: 'Detailed readership statistics so departments can see the real reach of their work.' },
  { icon: FolderOpen, title: 'Program Collections', copy: 'Curated collections that group research by program, department, and theme.' },
  { icon: ShieldCheck, title: 'Secure Archive', copy: 'Reliable access, storage, and long-term management of institutional research archives.' },
];

const team = [
  { name: 'Jason Paul Simborios', credential: 'M.B.A.', role: 'Head of Research Office' },
];

const partners = [
  'De La Salle John Bosco College',
  'Research Laboratory',
  'University Library',
  'Student Affairs Office',
  'Academic Departments',
  'Community Partners',
];

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

function StatCard({ label, values, icon: Icon }) {
  return (
    <div className="about-stat-card">
      <div className="about-stat-label">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
        <span>{label}</span>
      </div>
      <div className="about-stat-metrics">
        {values.map(v => (
          <div key={v.caption} className="about-stat-metric">
            <div className="about-stat-value">{v.value}</div>
            <div className="about-stat-caption">{v.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function About() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get(`${API}/stats/`)
      .then(r => { if (r.data && !Array.isArray(r.data)) setStats(r.data); })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-cream">
      {/* ================= HERO ================= */}
      <section className="about-hero">
        <div className="container-page relative z-10 pb-24 pt-12 lg:pb-28 lg:pt-14">
          <div className="max-w-[400px]">
            <div className="eyebrow inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/40 px-[11px] py-[7px] text-black backdrop-blur-sm">
              <Landmark className="h-[13px] w-[13px]" />
              <span>Central Research Repository</span>
            </div>

            <h1 className="about-page-title mt-5 text-black">About ResearchHub.</h1>

            <p className="mt-5 text-[13.5px] leading-[1.6] text-black">
              ResearchHub is a comprehensive digital platform dedicated to centralizing, preserving,
              and showcasing the academic output of the institution. Our mission is to empower discovery,
              foster collaboration, and preserve knowledge for future generations.
            </p>

            <p className="mt-3.5 text-[13.5px] leading-[1.6] text-black">
              We provide students and faculty with easy access to a vast repository of research works,
              publications, and institutional data, supporting innovation and academic excellence.
            </p>

            <div className="mt-6">
              <Link to="/research" className="hero-cta">
                <span>View Details</span>
                <ArrowRight className="hero-arrow h-[14px] w-[14px]" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MAIN CONTENT ================= */}
      <main className="relative z-20 -mt-6">
        <div className="container-page pb-10">
          <div className="about-layout">
            {/* ---------- MAIN COLUMN ---------- */}
            <div className="flex flex-col gap-4">
              <div className="stat-grid">
                <StatCard
                  icon={BarChart3}
                  label="Platform Usage"
                  values={[
                    { value: stats?.total ?? '—', caption: 'Catalogued Works' },
                    { value: stats?.programs ?? '—', caption: 'Programs' },
                  ]}
                />
                <StatCard
                  icon={ShieldCheck}
                  label="Community"
                  values={[
                    { value: stats?.users ?? '—', caption: 'Registered Members' },
                    { value: stats?.approved ?? '—', caption: 'Approved Works' },
                  ]}
                />
              </div>

              <section className="content-section">
                <div className="section-label">Our Purpose</div>
                <h2 className="section-title mt-3 text-[25px]">Our Vision</h2>
                <p className="body-copy mt-3">
                  ResearchHub exists so that no piece of institutional knowledge is lost, overlooked, or
                  locked away. We are building a single, dependable home for the research produced across
                  our programs — one that stays open to students, to faculty, and to the wider academic
                  community for as long as it is needed.
                </p>
              </section>

              <section className="content-section">
                <h2 className="section-title text-[25px]">Who We Serve</h2>
                <ul className="about-list mt-3.5">
                  {served.map(item => (
                    <li key={item}>
                      <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-brand" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="content-section">
                <h2 className="section-title text-[25px]">Key Features</h2>
                <div className="feature-grid mt-4">
                  {features.map(f => (
                    <div key={f.title} className="feature-card">
                      <div className="feature-icon w-8 h-8">
                        <f.icon className="h-[17px] w-[17px]" />
                      </div>
                      <div className="feature-title mt-3">{f.title}</div>
                      <p className="feature-description mt-1.5">{f.copy}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="content-section">
                <h2 className="section-title text-[25px]">Contact Us</h2>
                <div className="contact-list mt-4">
                  <div className="contact-row">
                    <span className="contact-icon"><Mail className="h-[15px] w-[15px]" /></span>
                    <div>
                      <strong className="block text-[12px] font-bold text-forest">Email</strong>
                      <a href="mailto:info@researchhub.edu" className="hover:text-emerald-brand hover:underline">
                        info@researchhub.edu
                      </a>
                    </div>
                  </div>
                  <div className="contact-row">
                    <span className="contact-icon"><MapPin className="h-[15px] w-[15px]" /></span>
                    <div>
                      <strong className="block text-[12px] font-bold text-forest">Research Laboratory</strong>
                      <span>De La Salle John Bosco College</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* ---------- SIDEBAR ---------- */}
            <aside className="flex flex-col gap-[18px]">
              <section className="side-card">
                <h2 className="section-title text-[20px]">Our Team</h2>
                <div className="mt-2">
                  {team.map(member => (
                    <div key={member.name} className="team-member py-3">
                      <span className="team-photo">{initials(member.name)}</span>
                      <div className="min-w-0">
                        <div className="team-name truncate">{member.name}</div>
                        <div className="team-role">
                          {member.credential ? `${member.credential} · ${member.role}` : member.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="side-card">
                <h2 className="section-title text-[20px]">Partners</h2>
                <div className="partner-grid mt-4">
                  {partners.map(p => (
                    <span key={p} className="partner-logo">{p}</span>
                  ))}
                </div>
              </section>

              <section className="side-card">
                <h2 className="section-title text-[20px]">Repository Rules</h2>
                <ul className="about-list mt-3">
                  <li>
                    <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-brand" />
                    <span>Every submission is assigned a unique catalog code on approval.</span>
                  </li>
                  <li>
                    <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-brand" />
                    <span>Abstracts are previewed online; full texts are read on site.</span>
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}