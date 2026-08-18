'use client';

import { useEffect, useRef, useState } from 'react';

const ITEMS = [
  { href: '#basisprofilen', name: 'Basisprofilen', sub: 'Den fulde individuelle rapport' },
  { href: '#jobprofilen', name: 'Jobprofilen', sub: 'Jeres egne kompetenceområder' },
  { href: '#teamprofilen', name: 'Teamprofilen', sub: 'Hele afdelingen i ét billede' },
  { href: '#jobmatch', name: 'JobMatch', sub: 'Matchscore til rekruttering' },
] as const;

/** Ported from public_html/index.html: the "Produktet" dropdown in the header. */
export function ProductMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.blur();
      }
    }
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Hover opens it on pointer devices only, exactly as in the POC.
  const hoverCapable = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover:hover)').matches;

  return (
    <div
      className={open ? 'drop open' : 'drop'}
      ref={rootRef}
      onMouseEnter={() => {
        if (hoverCapable()) setOpen(true);
      }}
      onMouseLeave={() => {
        if (hoverCapable()) setOpen(false);
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        Produktet <span className="chev">&#9660;</span>
      </button>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.href}>
            <a href={item.href} onClick={() => setOpen(false)}>
              {item.name}
              <span>{item.sub}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
