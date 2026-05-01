import {
  createContext,
  useContext,
  type Context,
  type ReactNode,
} from 'react';

/**
 * Factory that builds the «&nbsp;3 contextes&nbsp;» pattern shared by every
 * `flow/<Module>/context.tsx` (Library / Goals / Journal / Mood, soon
 * Habits / Review). Each module page splits its local state across
 * three contexts so consumers re-render only on the slice they
 * actually read :
 *
 *   - **Data**    — `entries` / `load` / derived stats. Bumps on
 *                   fetch + on mutation.
 *   - **Filters** — raw filter state + the derived filtered slice.
 *                   Bumps on every filter interaction.
 *   - **Actions** — handlers (edit / delete / cycleStatus / etc.) +
 *                   transient UI flags. Stable identity across data
 *                   fetches (callbacks read live data via refs), so
 *                   action-only consumers never re-render on data
 *                   change.
 *
 * Without this factory each module re-implemented the same 35-LOC
 * boilerplate (3× `createContext`, the `useRequiredContext` helper,
 * the 3 hook wrappers, the triple-nested JSX provider). With it,
 * each module just declares the 3 value shapes and the factory
 * hands back `{ Provider, useData, useFilters, useActions }` — call
 * site is ~5 lines instead of ~35.
 *
 * Usage:
 * ```tsx
 * const { Provider: GoalsContexts, useData, useFilters, useActions } =
 *   createModuleContexts<GoalsDataValue, GoalsFiltersValue, GoalsActionsValue>('Goals');
 *
 * export const useGoalsData = useData;
 * export const useGoalsFilters = useFilters;
 * export const useGoalsActions = useActions;
 *
 * export function GoalsProvider({ children }) {
 *   // …local state, derived, callbacks…
 *   return (
 *     <GoalsContexts data={data} filters={filters} actions={actions}>
 *       {children}
 *     </GoalsContexts>
 *   );
 * }
 * ```
 */
export interface ModuleContexts<D, F, A> {
  Provider: (props: {
    data: D;
    filters: F;
    actions: A;
    children: ReactNode;
  }) => ReactNode;
  useData: () => D;
  useFilters: () => F;
  useActions: () => A;
}

export function createModuleContexts<D, F, A>(
  moduleName: string,
): ModuleContexts<D, F, A> {
  const DataContext = createContext<D | null>(null);
  const FiltersContext = createContext<F | null>(null);
  const ActionsContext = createContext<A | null>(null);

  function useRequired<T>(ctx: Context<T | null>, hookName: string): T {
    const v = useContext(ctx);
    if (v === null || v === undefined) {
      throw new Error(
        `${hookName}() must be used inside <${moduleName}Provider>`,
      );
    }
    return v;
  }

  function Provider({
    data,
    filters,
    actions,
    children,
  }: {
    data: D;
    filters: F;
    actions: A;
    children: ReactNode;
  }): ReactNode {
    return (
      <DataContext.Provider value={data}>
        <FiltersContext.Provider value={filters}>
          <ActionsContext.Provider value={actions}>
            {children}
          </ActionsContext.Provider>
        </FiltersContext.Provider>
      </DataContext.Provider>
    );
  }

  return {
    Provider,
    useData: () => useRequired(DataContext, `use${moduleName}Data`),
    useFilters: () => useRequired(FiltersContext, `use${moduleName}Filters`),
    useActions: () => useRequired(ActionsContext, `use${moduleName}Actions`),
  };
}
