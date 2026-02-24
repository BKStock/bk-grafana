import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { UserStorage } from '@grafana/runtime/internal';

const STORAGE_NAMESPACE = 'alerting';
const KEY_NAME_OVERRIDES = 'triagePredefinedNameOverrides';
const KEY_DISMISSED = 'triagePredefinedDismissed';

export interface UseTriagePredefinedOverridesResult {
  /** Custom names for predefined search IDs */
  nameOverrides: Record<string, string>;
  /** Predefined search IDs the user has dismissed (hidden from list) */
  dismissedIds: string[];
  /** Whether the initial load from storage is complete */
  isLoading: boolean;
  /** Set a custom name for a predefined search */
  setNameOverride: (id: string, name: string) => Promise<void>;
  /** Dismiss (hide) a predefined search from the list */
  dismissId: (id: string) => Promise<void>;
}

function isRecordOfStrings(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.entries(value).every(([, v]) => typeof v === 'string');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function parseJsonRecord(raw: string | null): Record<string, string> {
  if (raw == null || raw === '') {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecordOfStrings(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonStringArray(raw: string | null): string[] {
  if (raw == null || raw === '') {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStringArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Hook for persisting user customisations to predefined triage saved searches:
 * custom names (rename) and dismissed IDs (delete = hide from list).
 */
export function useTriagePredefinedOverrides(): UseTriagePredefinedOverridesResult {
  const [nameOverrides, setNameOverridesState] = useState<Record<string, string>>({});
  const [dismissedIds, setDismissedIdsState] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userStorage = useMemo(() => new UserStorage(STORAGE_NAMESPACE), []);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    const load = async () => {
      try {
        const [overridesRaw, dismissedRaw] = await Promise.all([
          userStorage.getItem(KEY_NAME_OVERRIDES),
          userStorage.getItem(KEY_DISMISSED),
        ]);
        setNameOverridesState(parseJsonRecord(overridesRaw));
        setDismissedIdsState(parseJsonStringArray(dismissedRaw));
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [userStorage]);

  const persistOverrides = useCallback(
    async (next: Record<string, string>) => {
      await userStorage.setItem(KEY_NAME_OVERRIDES, JSON.stringify(next));
    },
    [userStorage]
  );

  const persistDismissed = useCallback(
    async (next: string[]) => {
      await userStorage.setItem(KEY_DISMISSED, JSON.stringify(next));
    },
    [userStorage]
  );

  const setNameOverride = useCallback(
    async (id: string, name: string) => {
      const next = { ...nameOverrides, [id]: name };
      setNameOverridesState(next);
      await persistOverrides(next);
    },
    [nameOverrides, persistOverrides]
  );

  const dismissId = useCallback(
    async (id: string) => {
      const next = dismissedIds.includes(id) ? dismissedIds : [...dismissedIds, id];
      setDismissedIdsState(next);
      await persistDismissed(next);
    },
    [dismissedIds, persistDismissed]
  );

  return {
    nameOverrides,
    dismissedIds,
    isLoading,
    setNameOverride,
    dismissId,
  };
}
