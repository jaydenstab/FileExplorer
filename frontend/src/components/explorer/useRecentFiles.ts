import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRecentFiles } from '../../lib/api';
import { recentItemToFileItem } from './types';

const RECENT_LIMIT = 20;

/**
 * Recently modified files for the nav pane; keyed by selected directory scope.
 */
export function useRecentFiles(selectedDirectories: string[]) {
  const directoriesKey = useMemo(
    () => [...selectedDirectories].sort().join(','),
    [selectedDirectories]
  );

  return useQuery({
    queryKey: ['recent', directoriesKey, RECENT_LIMIT] as const,
    queryFn: async ({ signal }) => {
      const res = await fetchRecentFiles(selectedDirectories, RECENT_LIMIT, signal);
      return res.items.map(recentItemToFileItem);
    },
    staleTime: 15_000,
    gcTime: 120_000,
  });
}
