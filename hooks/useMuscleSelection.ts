/**
 * useMuscleSelection.ts
 * ---------------------------------------------------------------------------
 * React hook that manages the multi-selection state of the interactive body
 * silhouette.
 *
 * The hook is intentionally UI-agnostic: it stores the ids of the currently
 * selected `<path>` fragments and exposes a small, stable API (all callbacks
 * are memoised with `useCallback`) so it can be dropped into any screen that
 * renders `<WebBodySilhouette />`.
 *
 * It resolves raw path ids into full {@link MuscleEntry} records and produces
 * the union of related clinical conditions across the current selection.
 * ---------------------------------------------------------------------------
 */

import { useCallback, useMemo, useState } from 'react';

import {
  MAPPED_MUSCLE_IDS,
  MUSCLE_MAP,
  type MuscleEntry,
} from '../services/medical/muscleMapping';

/* ===========================================================================
 * Types
 * ======================================================================== */

export interface UseMuscleSelectionResult {
  /** Ordered list of currently selected SVG path ids. */
  selectedIds: string[];
  /** Number of selected fragments. */
  count: number;
  /** Whether at least one fragment is selected. */
  hasSelection: boolean;
  /** Adds a muscle to the selection (no-op if already selected). */
  selectMuscle: (id: string) => void;
  /** Removes a muscle from the selection (no-op if not selected). */
  deselectMuscle: (id: string) => void;
  /** Toggles a muscle in/out of the selection. */
  toggleMuscle: (id: string) => void;
  /** Clears the entire selection. */
  clearSelection: () => void;
  /** Replaces the whole selection with the provided ids. */
  setSelection: (ids: string[]) => void;
  /** Returns whether a given id is currently selected. */
  isSelected: (id: string) => boolean;
  /** Returns the full muscle records for the current selection. */
  getSelectedMuscles: () => MuscleEntry[];
  /** Returns the de-duplicated union of related conditions. */
  getRelatedConditions: () => string[];
}

export interface UseMuscleSelectionOptions {
  /** Optional initial selection. */
  initialSelectedIds?: string[];
  /**
   * When true, only ids present in {@link MAPPED_MUSCLE_IDS} are accepted.
   * Defaults to `true` so the selection always maps to medical data.
   */
  onlyMapped?: boolean;
  /** Optional callback fired whenever the selection changes. */
  onChange?: (selectedIds: string[]) => void;
}

/* ===========================================================================
 * Hook
 * ======================================================================== */

export function useMuscleSelection(
  options: UseMuscleSelectionOptions = {},
): UseMuscleSelectionResult {
  const { initialSelectedIds = [], onlyMapped = true, onChange } = options;

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const unique = Array.from(new Set(initialSelectedIds));
    return onlyMapped ? unique.filter((id) => MAPPED_MUSCLE_IDS.has(id)) : unique;
  });

  /** Normalises + filters an incoming list of ids. */
  const sanitize = useCallback(
    (ids: string[]): string[] => {
      const unique = Array.from(new Set(ids));
      return onlyMapped ? unique.filter((id) => MAPPED_MUSCLE_IDS.has(id)) : unique;
    },
    [onlyMapped],
  );

  /** Applies a new selection and notifies the optional listener. */
  const commit = useCallback(
    (next: string[]) => {
      setSelectedIds(next);
      if (onChange) {
        onChange(next);
      }
    },
    [onChange],
  );

  const selectMuscle = useCallback(
    (id: string) => {
      if (onlyMapped && !MAPPED_MUSCLE_IDS.has(id)) {
        return;
      }
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          return prev;
        }
        const next = [...prev, id];
        if (onChange) {
          onChange(next);
        }
        return next;
      });
    },
    [onlyMapped, onChange],
  );

  const deselectMuscle = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        if (!prev.includes(id)) {
          return prev;
        }
        const next = prev.filter((selected) => selected !== id);
        if (onChange) {
          onChange(next);
        }
        return next;
      });
    },
    [onChange],
  );

  const toggleMuscle = useCallback(
    (id: string) => {
      if (onlyMapped && !MAPPED_MUSCLE_IDS.has(id)) {
        return;
      }
      setSelectedIds((prev) => {
        const next = prev.includes(id)
          ? prev.filter((selected) => selected !== id)
          : [...prev, id];
        if (onChange) {
          onChange(next);
        }
        return next;
      });
    },
    [onlyMapped, onChange],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      if (onChange) {
        onChange([]);
      }
      return [];
    });
  }, [onChange]);

  const setSelection = useCallback(
    (ids: string[]) => {
      commit(sanitize(ids));
    },
    [commit, sanitize],
  );

  /** Fast membership lookup for the render layer. */
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const isSelected = useCallback(
    (id: string): boolean => selectedSet.has(id),
    [selectedSet],
  );

  const getSelectedMuscles = useCallback((): MuscleEntry[] => {
    return selectedIds
      .map((id) => MUSCLE_MAP[id])
      .filter((entry): entry is MuscleEntry => Boolean(entry));
  }, [selectedIds]);

  const getRelatedConditions = useCallback((): string[] => {
    const conditions = new Set<string>();
    for (const id of selectedIds) {
      const entry = MUSCLE_MAP[id];
      if (!entry) {
        continue;
      }
      for (const condition of entry.relatedConditions) {
        conditions.add(condition);
      }
    }
    return Array.from(conditions);
  }, [selectedIds]);

  return {
    selectedIds,
    count: selectedIds.length,
    hasSelection: selectedIds.length > 0,
    selectMuscle,
    deselectMuscle,
    toggleMuscle,
    clearSelection,
    setSelection,
    isSelected,
    getSelectedMuscles,
    getRelatedConditions,
  };
}

export default useMuscleSelection;
