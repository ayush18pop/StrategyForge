import { useMemo, useReducer, useState, useEffect } from 'react';
import {
  fetchStrategyTelemetry,
  type StrategyTelemetryBootstrap,
} from '../../lib/api';

const POLL_INTERVAL_MS = 30_000;

type TelemetryConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface UseStrategyTelemetryResult {
  data: StrategyTelemetryBootstrap | null;
  isLoading: boolean;
  error: string | null;
  stale: boolean;
  connectionState: TelemetryConnectionState;
  nextReviewCountdown: string;
}

interface TelemetryState {
  data: StrategyTelemetryBootstrap | null;
  isLoading: boolean;
  error: string | null;
  stale: boolean;
  connectionState: TelemetryConnectionState;
}

type TelemetryAction =
  | { type: 'reset' }
  | { type: 'no-family' }
  | { type: 'loaded'; data: StrategyTelemetryBootstrap }
  | { type: 'error'; message: string }
  | { type: 'polling' };

const initialTelemetryState: TelemetryState = {
  data: null,
  isLoading: true,
  error: null,
  stale: false,
  connectionState: 'connecting',
};

export function useStrategyTelemetry(familyId: string): UseStrategyTelemetryResult {
  const [state, dispatch] = useReducer(telemetryReducer, initialTelemetryState);
  const [now, setNow] = useState(() => Date.now());

  // Tick every second for countdown display
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // Poll telemetry endpoint
  useEffect(() => {
    if (!familyId) {
      dispatch({ type: 'no-family' });
      return;
    }

    let cancelled = false;
    dispatch({ type: 'reset' });

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await fetchStrategyTelemetry(familyId);
        if (cancelled) return;
        dispatch({ type: 'loaded', data });
      } catch (error) {
        if (cancelled) return;
        dispatch({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      dispatch({ type: 'polling' });
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [familyId]);

  const nextReviewCountdown = useMemo(() => {
    if (!state.data?.reviewWindow.nextReviewAt) return '00:00:00';
    return formatCountdown(Math.max(0, state.data.reviewWindow.nextReviewAt - now));
  }, [state.data?.reviewWindow.nextReviewAt, now]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    stale: state.stale,
    connectionState: state.connectionState,
    nextReviewCountdown,
  };
}

function telemetryReducer(state: TelemetryState, action: TelemetryAction): TelemetryState {
  switch (action.type) {
    case 'reset':
      return {
        data: null,
        isLoading: true,
        error: null,
        stale: false,
        connectionState: 'connecting',
      };
    case 'no-family':
      return {
        data: null,
        isLoading: false,
        error: null,
        stale: false,
        connectionState: 'offline',
      };
    case 'polling':
      return {
        ...state,
        stale: true,
        connectionState: state.data ? 'reconnecting' : 'connecting',
      };
    case 'loaded':
      return {
        data: action.data,
        isLoading: false,
        error: null,
        stale: false,
        connectionState: 'live',
      };
    case 'error':
      return {
        ...state,
        isLoading: false,
        error: action.message,
        connectionState: 'offline',
      };
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}
