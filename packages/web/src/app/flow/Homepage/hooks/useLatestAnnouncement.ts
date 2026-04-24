import { useEffect, useState } from 'react';

/**
 * Latest active announcement, as exposed by `GET /announcements`.
 *
 * The back-end for announcements is tracked in issue #19 (R10). Until
 * the route lands we expect 404 and silently report "empty" so the
 * spotlight renders nothing — no tombstone in the UI. As soon as the
 * route ships, this hook starts returning rows without any edit here.
 */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** ISO timestamp the announcement went live, if any. */
  publishedAt?: string;
  /** ISO timestamp of server-side row creation. Back-compat fallback. */
  createdAt?: string;
}

export interface AnnouncementState {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  announcement: Announcement | null;
  error: string;
}

function apiBase(): string {
  return (
    (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? '/api'
  );
}

interface RawAnnouncement {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  message?: unknown;
  published_at?: unknown;
  publishedAt?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
}

function normalise(raw: RawAnnouncement | null): Announcement | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const title = typeof raw.title === 'string' ? raw.title : '';
  // Back-compat: legacy PB column was `message`.
  const body =
    typeof raw.body === 'string'
      ? raw.body
      : typeof raw.message === 'string'
        ? raw.message
        : '';
  if (!id) return null;
  const out: Announcement = { id, title, body };
  const publishedAt = raw.publishedAt ?? raw.published_at;
  const createdAt = raw.createdAt ?? raw.created_at;
  if (typeof publishedAt === 'string') out.publishedAt = publishedAt;
  if (typeof createdAt === 'string') out.createdAt = createdAt;
  return out;
}

export default function useLatestAnnouncement(): AnnouncementState {
  const [state, setState] = useState<AnnouncementState>({
    status: 'idle',
    announcement: null,
    error: '',
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', announcement: null, error: '' });

    (async () => {
      try {
        const res = await fetch(`${apiBase()}/announcements?limit=1`, {
          credentials: 'include',
        });
        // Route not wired yet (R10 / #19) — treat as empty, no UI tombstone.
        if (res.status === 404) {
          if (!cancelled) setState({ status: 'empty', announcement: null, error: '' });
          return;
        }
        if (!res.ok) {
          if (!cancelled)
            setState({ status: 'error', announcement: null, error: `${res.status}` });
          return;
        }
        const raw = (await res.json().catch(() => null)) as unknown;
        const list: RawAnnouncement[] = Array.isArray(raw)
          ? (raw as RawAnnouncement[])
          : raw && typeof raw === 'object' && Array.isArray((raw as { announcements?: unknown }).announcements)
            ? ((raw as { announcements: RawAnnouncement[] }).announcements)
            : [];
        const latest = list.length > 0 ? normalise(list[0]!) : null;
        if (cancelled) return;
        setState({
          status: latest ? 'ready' : 'empty',
          announcement: latest,
          error: '',
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          announcement: null,
          error: err instanceof Error ? err.message : 'Impossible de charger.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
