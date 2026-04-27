import { Component, type ErrorInfo, type ReactNode } from 'react';
import Button from '@/ui/atoms/dirk/Button';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional label surfaced in the fallback UI ("dans Mood", "du module…").
   * Helpful when several boundaries nest.
   */
  scope?: string;
  /**
   * Optional override for the fallback renderer. Gets the caught error +
   * a reset callback that clears the boundary state so children re-render.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * React error boundary — catches render + lifecycle errors below it and
 * swaps the subtree for a fallback UI instead of taking the whole app
 * down with a blank page.
 *
 * Per the migration roadmap, we install this at two levels:
 *   - global in `main.jsx` so a crash anywhere stays contained
 *   - per-module around each lazy-loaded module so one broken module
 *     doesn't prevent the rest of the app from loading
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.scope ?? 'global', error, info);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div role="alert" className="p-6 text-center">
        <p className="mb-2 font-medium">
          Une erreur est survenue{this.props.scope ? ` dans ${this.props.scope}` : ''}.
        </p>
        <p className="mb-4 text-sm opacity-80">{error.message}</p>
        <Button variant="primary" size="md" onClick={this.reset}>
          Réessayer
        </Button>
      </div>
    );
  }
}
