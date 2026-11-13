import React from 'react';

function BookHalf({ side, title, authors, type }) {
  return (
    <>
      <div className={`book-leaf book-page book-leaf-${side}`} />
      <div className={`book-leaf book-cover book-leaf-${side}`}>
        <div className="book-cover-text">
          <img
            src="/logo.png"
            alt="De La Salle John Bosco College logo"
            className="h-14 w-14 rounded-full bg-white object-contain p-1"
          />
          <span className="book-cover-brand">ResearchHub</span>
          {title && <span className="book-cover-title" style={{ fontSize: 'clamp(14px, 3vw, 22px)' }}>{title}</span>}
          {authors && <span className="book-cover-authors" style={{ fontSize: 'clamp(10px, 2vw, 13px)' }}>{authors}</span>}
          {type && <span className="book-cover-type" style={{ fontSize: 'clamp(8px, 1.5vw, 10px)' }}>{type}</span>}
        </div>
      </div>
    </>
  );
}

export default function BookOpening({ title, authors, type }) {
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`book-overlay${leaving ? ' book-leaving' : ''}`} role="status" aria-label="Opening research">
      <div className="book-scene">
        <div className="book-wrap">
          <BookHalf side="left" title={title} authors={authors} type={type} />
          <BookHalf side="right" title={title} authors={authors} type={type} />
        </div>
      </div>
      <div className="book-caption">
        <p className="book-caption-label">Now Opening</p>
        <p className="book-caption-title">{title || 'Research Work'}</p>
        {authors && <p className="book-caption-authors">{authors}</p>}
        {type && <p className="book-caption-meta">{type}</p>}
      </div>
    </div>
  );
}