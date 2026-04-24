/// <reference types="vite/client" />

/**
 * Legacy JSX modules (being progressively migrated to TSX) are imported
 * by the TS config/router files. Declare them ambiently so TypeScript
 * accepts the imports without flipping `allowJs: true` (which would pull
 * thousands of JSX files into the type-check pass).
 */
declare module '*.jsx' {
  import type { ComponentType } from 'react';
  const Component: ComponentType<Record<string, unknown>>;
  export default Component;
}
