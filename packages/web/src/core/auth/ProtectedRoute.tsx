import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/core/auth/use-session';

export interface ProtectedRouteProps {
  adminOnly?: boolean;
  children?: ReactNode;
}

/**
 * Route guard driven by the new Zustand session.
 *
 * Calling `useSession()` kicks off an `/auth/me` fetch on mount if the
 * store hasn't been hydrated yet. While the fetch is in flight
 * (`status === 'loading'`) we render nothing to avoid a flash of
 * redirect-to-login.
 *
 *   - unauthenticated → `<Navigate to="/login" />`
 *   - authenticated + adminOnly + role≠admin → `<Navigate to="/flow/home" />`
 *   - authenticated → children / Outlet
 */
export default function ProtectedRoute({
  adminOnly = false,
  children,
}: ProtectedRouteProps) {
  const { status, user } = useSession();
  const location = useLocation();

  if (status === 'loading') return null;

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/flow/home" replace />;
  }

  if (children) return <>{children}</>;
  return <Outlet />;
}
