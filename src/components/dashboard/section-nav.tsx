'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SectionNavItem {
  id: string;
  label: string;
}

export function SectionNav({
  sections,
  className,
  scrollOffset = 120,
  leading,
}: {
  sections: SectionNavItem[];
  /** Overrides the sticky offset + spacing (defaults to host top-nav layout). */
  className?: string;
  /** Scroll position (px) at which a section becomes active. */
  scrollOffset?: number;
  /** Optional content pinned before the tabs (e.g. a back link / breadcrumb). */
  leading?: React.ReactNode;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    function onScroll() {
      let current = sections[0]?.id ?? '';
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= scrollOffset) {
          current = s.id;
        }
      }
      setActive(current);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections, scrollOffset]);

  function handleClick(e: React.MouseEvent, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setActive(id);
  }

  return (
    <div
      className={cn(
        'sticky z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70',
        className ?? 'top-14 mt-6'
      )}
    >
      <div className="flex items-stretch gap-3 sm:gap-4">
        {leading && (
          <div className="flex shrink-0 items-center border-r pr-3 sm:pr-4">
            {leading}
          </div>
        )}
        <nav className="flex gap-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => handleClick(e, s.id)}
              className={cn(
                'whitespace-nowrap border-b-2 py-3 text-sm transition-colors',
                active === s.id
                  ? 'border-foreground font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
