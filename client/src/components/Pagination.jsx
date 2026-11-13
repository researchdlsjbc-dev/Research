import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function buildPageItems(page, pages) {
  const visible = [];
  const push = (n) => { if (!visible.includes(n)) visible.push(n); };

  push(1);
  for (let p = page - 1; p <= page + 1; p += 1) if (p > 1 && p < pages) push(p);
  if (pages > 1) push(pages);
  visible.sort((a, b) => a - b);

  const items = [];
  visible.forEach((p, i) => {
    if (i > 0 && p - visible[i - 1] > 1) items.push('gap');
    items.push(p);
  });
  return items;
}

export default function Pagination({ page, pages, onChange, className = '' }) {
  if (!Number.isFinite(pages) || pages < 2) return null;

  return (
    <nav className={`pagination${className ? ` ${className}` : ''}`} aria-label="Pagination">
      <button
        type="button"
        className="page-btn"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {buildPageItems(page, pages).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className="page-btn page-btn-gap" aria-hidden="true">…</span>
        ) : (
          <button
            key={item}
            type="button"
            className={`page-btn${item === page ? ' is-active' : ''}`}
            aria-label={`Go to page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        className="page-btn"
        aria-label="Next page"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}
