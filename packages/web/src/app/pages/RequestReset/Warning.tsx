import type { ReactNode } from 'react';

/**
 * Hard warning callout for the reset flow — uses the system danger
 * red (not the sauge-paired terracotta) because the consequence is
 * irreversible data loss. Title carries the punchline so it reads
 * at a glance ; the body is one short sentence of context.
 *
 * Reused by `DestroyForm` (before submit) and `SentPanel` (after
 * the email is sent) so the user sees the consequence framed at
 * each step.
 */
export default function Warning({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-md border border-danger bg-danger/10 px-3.5 py-3 text-[12.5px] leading-[1.5] text-danger"
    >
      <p className="mb-1 flex items-center gap-1.5 font-semibold tracking-[0.01em]">
        <span aria-hidden="true">⚠</span>
        {title}
      </p>
      <p>{children}</p>
    </div>
  );
}
