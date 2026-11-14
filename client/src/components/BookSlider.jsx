import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

const DELAY = 6000;

export default function BookSlider({ items }) {
  const [index, setIndex] = useState(0);
  const timer = useRef(null);
  const count = items.length;

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
