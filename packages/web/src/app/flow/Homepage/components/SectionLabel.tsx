import type { ReactNode } from 'react';

/** Small bold-uppercase header used at the top of every Home
 *  block (« À voir », « Mood », « Goals », « Passage récent »…).
 *  Tighter top margin than the Goals / Journal version because
 *  the Home blocks stack closer together. */
export default function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-[12px] font-semibold tracking-[0.02em] text-muted">
      {children}
    </div>
  );
}
