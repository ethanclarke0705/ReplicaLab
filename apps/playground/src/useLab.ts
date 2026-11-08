import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScenarioName } from '@replicalab/simulator';
import { LabSession } from './session.js';

export function useLab() {
  const [initial] = useState(() => new LabSession());
  const session = useRef(initial);
  const [view, setView] = useState(() => initial.snapshot());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [notice, setNotice] = useState(
    'Ready. Edit any replica, then advance time to deliver its changes.',
  );

  const perform = useCallback((action: (lab: LabSession) => void) => {
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
    if (!running) return;
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
  }, [running, perform]);

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
