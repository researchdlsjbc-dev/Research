import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../context/AuthContext';
import {
  Search, FileText, Folder, Landmark, BookOpen, ArrowRight, ChevronRight,
  ChevronLeft, Globe, Shield, GraduationCap, Users, Settings, Leaf, MapPin,
} from 'lucide-react';

const coverGradients = [
  'linear-gradient(150deg,#0b6b52,#053f31)',
  'linear-gradient(150deg,#0f8a6c,#075744)',
  'linear-gradient(150deg,#2a9d8f,#0b6b52)',
  'linear-gradient(150deg,#103f37,#0b6b52)',
  'linear-gradient(150deg,#1b7f68,#093f31)',
  'linear-gradient(150deg,#13876d,#075744)',
];

const categoryIcons = [Settings, Users, Leaf, Globe, BookOpen, GraduationCap];

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function BookSlider({ items }) {
  const [index, setIndex] = useState(0);
  const timer = useRef(null);
  const count = items.length;
  const DELAY = 6000;

  const go = (i) => setIndex(((i % count) + count) % count);

  const restart = () => {
    clearInterval(timer.current);
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), DELAY);
  };

  useEffect(() => {
    if (count < 2) return undefined;
    restart();
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!count) return null;

  return (
    <div>
      <div className="relative flex items-center justify-center lg:justify-end lg:mr-[19px]">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => { go(index - 1); restart(); }}
            aria-label="Previous research"
            className="slider-btn absolute right-full mr-3 top-1/2 z-10 -translate-y-1/2"
          >
            <ChevronLeft className="h-[17px] w-[17px]" />
          </button>

          <div className="relative w-[230px] overflow-hidden">
            {items.map((r, i) => (
              <article key={r.id} className={`hero-slide${i === index ? ' is-active' : ''}`}>
                <div className="book-3d mx-auto h-[298px] w-[230px]">
                  <div className="book-face">
                    <span className="eyebrow block text-white/50">Featured</span>
                    <span className="book-cover-title mt-2 block">
                      {r.title?.length > 46 ? `${r.title.slice(0, 44).trimEnd()}…` : r.title}
                    </span>
                    <span className="mt-3 block text-[12px] font-normal text-white/80">
                      {r.authors || 'Unattributed'}
                    </span>
                    <span className="book-spine" />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { go(index + 1); restart(); }}
            aria-label="Next research"
            className="slider-btn absolute left-full ml-3 top-1/2 z-10 -translate-y-1/2"
          >
            <ChevronRight className="h-[17px] w-[17px]" />
          </button>
        </div>
      </div>

      <div className="mx-auto mt-5 w-full max-w-[230px] lg:mx-0 lg:mr-[19px] lg:ml-auto">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {items.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { go(i); restart(); }}
              aria-label={`Show featured research ${i + 1}`}
              className={`hero-dot${i === index ? ' is-active' : ''}`}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-center">
          <Link to="/research" className="hero-cta">
            <span>View Details</span>
            <ArrowRight className="hero-arrow h-[14px] w-[14px]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const COPIES = 3;
const DELAY = 6000;
const GAP = 14;

function WorksCarousel({ items }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const timerRef = useRef(null);
  const posRef = useRef(0);

  const n = items.length;
  // Active window only ever travels through the middle copy, so the first and
  // last copies act as a seamless wrap-around buffer.
  const last = (COPIES - 1) * n - 1;

  // Measured fresh on every paint rather than cached, so the slide distance can
  // never drift from the rendered card width.
  const step = () => {
    const track = trackRef.current;
    if (!track || !track.children.length) return 0;
    return track.children[0].getBoundingClientRect().width + GAP;
  };

  // The track is moved by writing one inline style, the way the mockup does.
  // Driving it through React state instead re-rendered every card on each
  // slide, which is what made the motion stutter.
  const paint = (animate) => {
    const track = trackRef.current;
    if (!track) return;
    const x = -posRef.current * step();
    if (!animate) {
      track.style.transition = 'none';
      track.style.transform = `translateX(${x}px)`;
      void track.offsetWidth; // force reflow so the next move animates
      track.style.transition = '';
    } else {
      track.style.transform = `translateX(${x}px)`;
    }
  };

  const goNext = () => {
    if (!n) return;
    if (posRef.current >= last) {
      posRef.current = n - 1;
      paint(false);
      requestAnimationFrame(() => {
        posRef.current = n;
        paint(true);
      });
    } else {
      posRef.current += 1;
      paint(true);
    }
  };

  const goPrev = () => {
    if (!n) return;
    if (posRef.current <= 0) {
      posRef.current = 2 * n;
      paint(false);
      requestAnimationFrame(() => {
        posRef.current = 2 * n - 1;
        paint(true);
      });
    } else {
      posRef.current -= 1;
      paint(true);
    }
  };

  const start = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(goNext, DELAY);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const restart = () => {
    stop();
    start();
  };

  // Layout effect so the track is parked on the middle copy before the browser
  // paints, otherwise the first frame flashes the untranslated originals.
  useLayoutEffect(() => {
    if (!n) return undefined;
    posRef.current = n;
    paint(false);
    start();

    const onResize = () => paint(false);
    window.addEventListener('resize', onResize);

    // Cormorant Garamond lands after first paint and changes card widths.
    let cancelled = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => { if (!cancelled) paint(false); })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      stop();
      window.removeEventListener('resize', onResize);
    };
  }, [items]);

  if (!n) return null;

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); restart(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); restart(); }
  };

  return (
    <div className="mt-[22px] flex items-center gap-2.5">
      <button type="button" onClick={() => { goPrev(); restart(); }} aria-label="Previous research works" className="carousel-button">
        <ChevronLeft className="h-3 w-3" />
      </button>

      <div
        ref={viewportRef}
        className="carousel-viewport"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={stop}
        onMouseLeave={start}
      >
        <div ref={trackRef} className="carousel-track">
          {Array.from({ length: COPIES }).flatMap((_, copy) =>
            items.map((r, i) => (
              <Link
                key={`${copy}-${r.id}`}
                to={`/research/${r.id}`}
                className="research-card"
                aria-hidden={copy === 1 ? undefined : 'true'}
                tabIndex={copy === 1 ? undefined : -1}
              >
                <span className="research-cover" style={{ background: coverGradients[i % coverGradients.length] }}>
                  <span className="px-1 text-center font-display text-[13.5px] leading-tight text-white/95">
                    {r.program_code || r.program_name || 'Research'}
                  </span>
                </span>
                <div className="min-w-0">
                  <h3 className="research-card-title">{r.title}</h3>
                  {r.year && <span className="research-type">{r.year}</span>}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <button type="button" onClick={() => { goNext(); restart(); }} aria-label="Next research works" className="carousel-button">
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [latest, setLatest] = useState([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    axios.get(`${API}/stats/`)
      .then(r => { if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) setStats(r.data); })
      .catch(() => {});
    axios.get(`${API}/programs/`)
      .then(r => { if (Array.isArray(r.data)) setPrograms(r.data); })
      .catch(() => {});
    axios.get(`${API}/research/`, { params: { featured: 1, limit: 50 } })
      .then(r => { if (Array.isArray(r.data?.data)) setFeatured(r.data.data); })
      .catch(() => setLoadError(true));
    axios.get(`${API}/research/`, { params: { limit: 4, status: 'all' } })
      .then(r => { if (Array.isArray(r.data?.data)) setLatest(r.data.data); })
      .catch(() => setLoadError(true));
  }, []);

  // Every featured work drives the carousel below. The hero 3D slider is capped
  // because it renders one 6px dot per slide inside a 230px row, which would
  // overflow once the set gets large. The fallback only matters while the
  // is_featured migration is pending, and uses the whole latest batch so the
  // hero is never stranded on a two-slide rotation.
  const HERO_SLIDES = 10;
  const sliderItems = useMemo(
    () => (featured.length ? featured.slice(0, HERO_SLIDES) : latest),
    [featured, latest],
  );
  const carouselItems = useMemo(() => featured.slice(0, 6), [featured]);

  const totalWorks = stats?.total ?? latest.length;

  return (
    <div className="bg-cream">
      {loadError && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          <span className="font-semibold">Could not load the research catalog.</span>{' '}
          The repository is temporarily unavailable — please try again shortly.
        </div>
      )}
      {/* ================= HERO ================= */}
      <section className="hero-image relative overflow-hidden">
        <div className="container-page relative z-10 pb-24 pt-12 lg:pb-28 lg:pt-14">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[47%_1fr] lg:gap-6">
            <div>
              <div className="eyebrow inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/40 px-[11px] py-[7px] text-black backdrop-blur-sm">
                <BookOpen className="h-3 w-3" />
                <span>Central Research Repository</span>
              </div>

              <h1 className="hero-title mt-5 text-black">
                Discover research
                <br />
                <em className="text-black">works worth keeping.</em>
              </h1>

              <p className="mt-5 max-w-[390px] text-[14.5px] leading-[1.5] text-black">
                Browse and search the institutional repository. Submissions are automatically cataloged
                with unique codes.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <div className="stat-card flex h-16 w-[156px] items-center gap-3 px-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-soft-green">
                    <FileText className="h-[18px] w-[18px] text-emerald-brand" />
                  </span>
                  <div>
                    <div className="text-[23px] font-bold leading-none text-forest">{totalWorks}</div>
                    <div className="mt-1 text-[11px] font-semibold text-muted-green">Research Works</div>
                  </div>
                </div>
                <div className="stat-card flex h-16 w-[156px] items-center gap-3 px-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-soft-green">
                    <Folder className="h-[18px] w-[18px] text-emerald-brand" />
                  </span>
                  <div>
                    <div className="text-[23px] font-bold leading-none text-forest">{stats?.programs ?? programs.length}</div>
                    <div className="mt-1 text-[11px] font-semibold text-muted-green">Programs</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex flex-col items-stretch">
              <BookSlider items={sliderItems} />
            </div>
          </div>
        </div>
      </section>

      {/* ================= QUICK ACCESS ================= */}
      <section className="relative z-20">
        <div className="container-page py-10">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto] lg:gap-12">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] font-bold uppercase tracking-[0.10em] text-[#176653]">Quick Access</span>
                <span className="h-px w-[28px] bg-[#8FB3A7]" />
              </div>
              <h2 className="section-title mt-3.5 text-[24px] sm:text-[37px]">Explore. Read. Grow.</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Link to="/research" className="quick-card h-[72px] w-[108px]">
                <span className="quick-icon"><BookOpen className="h-[17px] w-[17px]" /></span>
                <span className="quick-label">Research Works</span>
              </Link>
              <a href="#programs" className="quick-card h-[72px] w-[108px]">
                <span className="quick-icon"><Folder className="h-[17px] w-[17px]" /></span>
                <span className="quick-label">Programs</span>
              </a>
              <Link to="/research" className="quick-card h-[72px] w-[108px]">
                <span className="quick-icon"><Search className="h-[17px] w-[17px]" /></span>
                <span className="quick-label">Browse Research</span>
              </Link>
              <Link to="/about" className="quick-card h-[72px] w-[108px]">
                <span className="quick-icon"><Landmark className="h-[17px] w-[17px]" /></span>
                <span className="quick-label !text-[11.5px] !leading-[1.2]">Institutional<br />Repository</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= ABOUT ================= */}
      <section className="about-repository" id="about">
        <div className="container-page relative z-[1] grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="section-label">About the Repository</div>
            <h2 className="about-title mt-4">
              Preserving knowledge,
              <br />
              empowering futures.
            </h2>
            <p className="mt-4 max-w-[360px] text-[14.5px] leading-[1.55] text-[#52736A]">
              The Central Research Repository is a digital library of academic and institutional research,
              providing easy access to scholarly works, programs, and resources from our community.
            </p>
            <Link to="/about" className="learn-more mt-6">
              <span>Learn More</span>
              <ArrowRight className="h-[13px] w-[13px]" />
            </Link>
          </div>

          <div className="repository-features w-full lg:w-[468px]">
            <div className="feature">
              <span className="feature-icon"><Globe className="h-[18px] w-[18px]" /></span>
              <h3 className="feature-title mt-3">Open Access</h3>
              <p className="feature-description mt-1.5">Access quality research anytime, anywhere.</p>
            </div>
            <div className="feature">
              <span className="feature-icon"><Shield className="h-[18px] w-[18px]" /></span>
              <h3 className="feature-title mt-3">Trusted Repository</h3>
              <p className="feature-description mt-1.5">Preserving authentic and credible works.</p>
            </div>
            <div className="feature">
              <span className="feature-icon"><GraduationCap className="h-[18px] w-[18px]" /></span>
              <h3 className="feature-title mt-3">Academic Excellence</h3>
              <p className="feature-description mt-1.5">Supporting research, innovation, and discovery.</p>
            </div>
            <div className="feature">
              <span className="feature-icon"><Users className="h-[18px] w-[18px]" /></span>
              <h3 className="feature-title mt-3">Community Driven</h3>
              <p className="feature-description mt-1.5">For students, faculty, and researchers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PROGRAMS ================= */}
      <section className="programs-section" id="programs">
        <div className="container-page relative z-[1]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="eyebrow flex items-center gap-2 text-[#176653]">
                <span>Browse by Category</span>
                <span className="h-px w-[25px] bg-[#8FB3A7]" />
              </div>
              <h2 className="section-title mt-2 text-[22px] sm:text-[36px]">Find research by program.</h2>
            </div>
            <Link to="/research" className="view-programs">
              <span>View All Programs</span>
              <ArrowRight className="view-arrow h-[13px] w-[13px]" />
            </Link>
          </div>

          <div className="program-grid">
            <Link to="/research" className="program-card">
              <span className="program-icon"><BookOpen className="h-[17px] w-[17px]" /></span>
              <span className="program-name">All Programs</span>
              <span className="program-count">{totalWorks}</span>
              <ChevronRight className="program-arrow h-[13px] w-[13px]" />
            </Link>

            {programs.map((p, i) => {
              const Icon = categoryIcons[i % categoryIcons.length];
              return (
                <Link key={p.id} to={`/research?program=${encodeURIComponent(p.code)}`} className="program-card">
                  <span className="program-icon"><Icon className="h-[17px] w-[17px]" /></span>
                  <span className="program-name">{p.name}</span>
                  <span className="program-count">{p.code}</span>
                  <ChevronRight className="program-arrow h-[13px] w-[13px]" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FEATURED WORKS ================= */}
      {featured.length > 0 && (
        <section className="featured-section">
          <div className="container-page">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="eyebrow flex items-center gap-2 text-[14.5px] text-[#176653]">
                  <span>Featured Collections</span>
                  <span className="h-px w-[25px] bg-[#8FB3A7]" />
                </div>
                <h2 className="section-title mt-2 text-[24px] sm:text-[40px]">Featured Research Works</h2>
              </div>
              <Link to="/research" className="view-programs !text-[14.5px]">
                <span>View All</span>
                <ArrowRight className="view-arrow h-[13px] w-[13px]" />
              </Link>
            </div>

            <WorksCarousel items={carouselItems} />
          </div>
        </section>
      )}

      {/* ================= LATEST ADDED ================= */}
      <section className="bg-[#F8F9F4] py-[45px] pb-[55px]">
        <div className="container-page">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="eyebrow flex items-center gap-2 text-[14.5px] text-[#176653]">
                <span>Recent Submissions</span>
                <span className="h-px w-[25px] bg-[#8FB3A7]" />
              </div>
              <h2 className="section-title mt-1.5 text-[24px] sm:text-[40px]">Latest Added Research</h2>
            </div>
            <Link to="/research" className="view-programs !text-[14.5px]">
              <span>View All</span>
              <ArrowRight className="view-arrow h-[13px] w-[13px]" />
            </Link>
          </div>

          {latest.length === 0 ? (
            <div className="research-table-wrapper px-6 py-14 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-soft-green text-emerald-brand">
                <BookOpen className="h-6 w-6" />
              </span>
              <h3 className="section-title text-[22px]">No research catalogued yet</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-[14.5px] text-muted-green">
                Submissions appear here as soon as an administrator approves them.
              </p>
              <button type="button" onClick={() => navigate('/research')} className="hero-cta mt-5">
                <span>Browse the repository</span>
                <ArrowRight className="hero-arrow h-[14px] w-[14px]" />
              </button>
            </div>
          ) : (
            <div className="research-table-wrapper">
              <div className="research-row table-header">
                <div>Title</div>
                <div>Program</div>
                <div>Date Added</div>
                <div>Year</div>
                <div />
              </div>

              {latest.map(r => (
                <Link key={r.id} to={`/research/${r.id}`} className="research-row">
                  <div className="research-row-title">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span>{r.title}</span>
                  </div>
                  <div>
                    {r.program_name && <span className="program-badge">{r.program_name}</span>}
                  </div>
                  <div className="research-date">{formatDate(r.created_at) || '—'}</div>
                  <div className="research-date">{r.year || '—'}</div>
                  <div className="research-row-arrow">
                    <ChevronRight className="h-[13px] w-[13px]" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
