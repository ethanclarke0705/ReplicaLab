import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScenarioName } from '@replicalab/simulator';
import { LabSession, type LabCheckpoint } from './session.js';

export interface LabOptions {
  initialSession?: LabSession;
  onCheckpoint?: (checkpoint: LabCheckpoint) => void;
  blocked?: boolean;
  restored?: boolean;
}

export function useLab(options: LabOptions = {}) {
  const [initial] = useState(() => options.initialSession ?? new LabSession());
  const currentOptions = useRef(options);
  currentOptions.current = options;
  const session = useRef(initial);
  const lastCheckpoint = useRef(JSON.stringify(initial.checkpoint()));
  const [view, setView] = useState(() => initial.snapshot());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [notice, setNotice] = useState(
    options.restored
      ? 'Saved replicas restored. Simulation restarted paused; advance time to reconcile missing operations.'
      : 'Ready. Edit any replica, then advance time to deliver its changes.',
  );

  const perform = useCallback((action: (lab: LabSession) => void) => {
    if (currentOptions.current.blocked) return false;
    try {
      action(session.current);
      setError(null);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The simulation could not complete this action.',
      );
      setRunning(false);
      return false;
    } finally {
      setView(session.current.snapshot());
      if (currentOptions.current.onCheckpoint) {
        const checkpoint = session.current.checkpoint();
        const encoded = JSON.stringify(checkpoint);
        if (encoded !== lastCheckpoint.current) {
          lastCheckpoint.current = encoded;
          currentOptions.current.onCheckpoint(checkpoint);
        }
      }
    }
  }, []);

  const replace = useCallback(
    (seed: number, scenario?: ScenarioName) => {
      setRunning(false);
      return perform(() => {
        session.current = new LabSession(seed, scenario);
        setGeneration((value) => value + 1);
        setNotice(
          scenario
            ? 'Scenario completed and paused. Inspect the timeline to see how it resolved.'
            : 'Lab reset. A fresh session is ready; previous edits have been cleared.',
        );
      });
    },
    [perform],
  );

  useEffect(() => {
    if (!running || options.blocked) return;
    const timer = window.setInterval(() => {
      if (session.current.simulation.events().length >= 15_000) {
        setRunning(false);
        setNotice(
          'Playback paused at 15,000 events to keep the lab responsive. Inspect this run or reset the lab.',
        );
        return;
      }
      perform((lab) => {
        lab.simulation.advanceBy(100, 5_000);
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [running, perform, options.blocked]);

  useEffect(() => {
    if (options.blocked) setRunning(false);
  }, [options.blocked]);

  return {
    view,
    running,
    setRunning,
    error,
    dismissError: () => setError(null),
    generation,
    notice,
    perform,
    replace,
  };
}

export type LabActions = ReturnType<typeof useLab>;
