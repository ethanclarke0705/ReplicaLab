import { useState } from 'react';
import { LabSession } from './session.js';

export function App() {
  const [session] = useState(() => new LabSession());
  const [view, setView] = useState(() => session.snapshot());
  return (
    <main>
      <p>REPLICALAB / LOCAL SIMULATION</p>
      <h1>Replication playground</h1>
      <p>Three independent replicas. One shared operation history.</p>
      <button
        onClick={() => {
          session.simulation.advanceBy(100);
          setView(session.snapshot());
        }}
      >
        Advance 100 ms
      </button>
      <p>
        {view.now} simulated ms · {view.converged ? 'Converged' : 'Diverged'}
      </p>
      <div className="replica-grid">
        {view.replicas.map((replica) => (
          <section key={replica.id}>
            <h2>Replica {replica.id.toUpperCase()}</h2>
            <p>
              Logical clock {replica.clock} · {replica.count} operations
            </p>
            <pre>
              {JSON.stringify(Object.fromEntries(replica.entries), null, 2)}
            </pre>
          </section>
        ))}
      </div>
    </main>
  );
}
