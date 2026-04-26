import { Navigate } from 'react-router-dom';

/**
 * Settings is now a tabbed section inside `Mon compte` (Préférences
 * + Modules tabs). This route stays in place as a redirect so old
 * bookmarks and the legacy `OnboardingModal` link don't 404 — the
 * canonical URL is `/flow/account`.
 */
export default function SettingsPage() {
  return <Navigate to="/flow/account" replace />;
}
