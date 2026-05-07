import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  startReindex,
  getReindexStatus,
  type ReindexStartResponse,
  type ReindexStatusResponse,
} from '../../lib/api';
import type { StatusState } from '../StatusBar';

interface UseReindexStatusParams {
  selectedDirectories: string[];
  setAdvancedExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
}

interface UseReindexStatusResult {
  startReindexMutation: ReturnType<typeof useMutation<ReindexStartResponse, Error, string>>;
  reindexStatus: ReindexStatusResponse | undefined;
  reindexStatusError: Error | null;
  handleReindex: () => void;
  /** Status to show in StatusBar when indexing or in cooldown; null when idle */
  statusContribution: StatusState | null;
  /** True when reindex just completed; parent uses for success toast, clears after 3s */
  reindexComplete: boolean;
  /** Error message when user tries to reindex with no directories; clears after 4s */
  localError: string | null;
}

export function useReindexStatus({
  selectedDirectories,
  setAdvancedExpanded,
}: UseReindexStatusParams): UseReindexStatusResult {
  const [jobId, setJobId] = useState<string | null>(null);
  const [statusContribution, setStatusContribution] = useState<StatusState | null>(null);
  const [reindexComplete, setReindexComplete] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);
  const jobIdClearTimeoutRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const prevJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
      if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
      if (completeTimeoutRef.current) window.clearTimeout(completeTimeoutRef.current);
      if (jobIdClearTimeoutRef.current) window.clearTimeout(jobIdClearTimeoutRef.current);
    };
  }, []);

  const startReindexMutation = useMutation({
    mutationFn: (directory: string) => startReindex(directory),
    onSuccess: (data) => {
      setJobId(data.job_id);
    },
  });

  const { data: reindexStatus, error: reindexStatusError } = useQuery<ReindexStatusResponse>({
    queryKey: ['reindex-status', jobId],
    queryFn: () => getReindexStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'indexing' ? 500 : false;
    },
  });

  useEffect(() => {
    if (reindexStatus?.status === 'indexing') {
      setStatusContribution({
        type: 'reindex',
        message: `Indexing ${reindexStatus.directory}`,
        progress: {
          current: reindexStatus.current,
          total: reindexStatus.total,
          percent: reindexStatus.percent,
          currentFile: reindexStatus.current_file,
          phase: reindexStatus.phase,
        },
      });
    } else if (reindexStatus?.status === 'completed') {
      setReindexComplete(true);
      if (completeTimeoutRef.current) window.clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = window.setTimeout(() => {
        setReindexComplete(false);
        completeTimeoutRef.current = null;
      }, 3000);

      queryClient.invalidateQueries({ queryKey: ['search'] });

      if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = window.setTimeout(() => {
        setStatusContribution((prev) => (prev?.type === 'reindex' ? null : prev));
        statusTimeoutRef.current = null;
      }, 3000);

      if (jobIdClearTimeoutRef.current) window.clearTimeout(jobIdClearTimeoutRef.current);
      jobIdClearTimeoutRef.current = window.setTimeout(() => {
        setJobId(null);
        jobIdClearTimeoutRef.current = null;
      }, 3000);
    } else if (reindexStatus?.status === 'error') {
      if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = window.setTimeout(() => {
        setStatusContribution((prev) => (prev?.type === 'reindex' ? null : prev));
        statusTimeoutRef.current = null;
      }, 2000);

      if (jobIdClearTimeoutRef.current) window.clearTimeout(jobIdClearTimeoutRef.current);
      jobIdClearTimeoutRef.current = window.setTimeout(() => {
        setJobId(null);
        jobIdClearTimeoutRef.current = null;
      }, 5000);
    }
  }, [reindexStatus, queryClient]);

  useEffect(() => {
    if (prevJobIdRef.current && !jobId) {
      setStatusContribution((prev) => (prev?.type === 'reindex' ? null : prev));
    }
    prevJobIdRef.current = jobId;
  }, [jobId]);

  const handleReindex = useCallback(() => {
    if (startReindexMutation.isPending || reindexStatus?.status === 'indexing') {
      return;
    }

    if (selectedDirectories.length === 0) {
      if (errorTimeoutRef.current) window.clearTimeout(errorTimeoutRef.current);
      setLocalError('Please select at least one directory to index.');
      errorTimeoutRef.current = window.setTimeout(() => setLocalError(null), 4000);
      return;
    }

    const dirToIndex = selectedDirectories[0];
    setJobId(null);
    setAdvancedExpanded(false);
    startReindexMutation.mutate(dirToIndex);
  }, [selectedDirectories, startReindexMutation, reindexStatus, setAdvancedExpanded]);

  return {
    startReindexMutation,
    reindexStatus,
    reindexStatusError: reindexStatusError ?? null,
    handleReindex,
    statusContribution,
    reindexComplete,
    localError,
  };
}
