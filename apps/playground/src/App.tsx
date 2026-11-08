import { useState } from 'react';
import { useLab } from './useLab.js';
import { ReplicaCard } from './ReplicaCard.js';
import { NetworkPanel } from './NetworkPanel.js';
import { ScenarioPanel } from './ScenarioPanel.js';
import { Timeline } from './Timeline.js';

export function App() {
  const lab = useLab();
  const { view, perform } = lab;
  const [seed, setSeed] = useState('42');
  return (
    <>
      <a href="#workspace" className="skip-link">
        Skip to playground
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ▧
          </span>
          Replica<span>Lab</span>
          <span className="version-tag">PLAYGROUND</span>
        </div>
        <a href="#guide">
          How it works <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main id="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">DISTRIBUTED SYSTEMS, MADE VISIBLE</p>
            <h1>
              Replication playground<span>.</span>
            </h1>
            <p className="intro">
              Make a change. Break a connection. Watch your replicas find
              agreement.
            </p>
          </div>
          <span className="local-badge">
            <span aria-hidden="true">●</span> Local simulation
          </span>
        </div>
        <div className="session-toolbar">
          <div className="playback">
            <button
              className="primary"
              onClick={() => lab.setRunning(!lab.running)}
              aria-pressed={lab.running}
            >
              {lab.running ? 'Ⅱ Pause' : '▶ Run'}
            </button>
            <button
              className="secondary"
              disabled={lab.running}
              onClick={() =>
                perform((session) => {
                  session.simulation.step();
                })
              }
            >
              Step event
            </button>
            <button
              className="secondary"
              disabled={lab.running}
              onClick={() =>
                perform((session) => {
                  session.simulation.advanceBy(100, 5000);
                })
              }
            >
              +100 ms
            </button>
            <button
              className="secondary"
              onClick={() =>
                perform((session) => session.simulation.synchronise())
              }
            >
              ↻ Sync now
            </button>
          </div>
          <form
            className="reset-controls"
            onSubmit={(event) => {
              event.preventDefault();
              lab.replace(Number(seed));
            }}
          >
            <label htmlFor="seed">Seed</label>
            <input
              id="seed"
              type="number"
              min={0}
              max={4294967295}
              step={1}
              required
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
            />
            <button type="submit" className="quiet">
              Reset lab
            </button>
          </form>
        </div>
        <p className="session-notice" role="status">
          {lab.notice}
        </p>
        {lab.error && (
          <div role="alert" className="error-banner">
            <span>{lab.error}</span>
            <button onClick={lab.dismissError} aria-label="Dismiss error">
              Dismiss
            </button>
          </div>
        )}
        <section className="status-strip" aria-label="Simulation status">
          <div
            className={`consistency ${view.converged ? 'converged' : 'diverged'}`}
          >
            <span className="status-dot" aria-hidden="true" />
            <div>
              <strong>
                {view.converged ? 'Replicas converged' : 'Replicas diverged'}
              </strong>
              <span>
                {view.converged
                  ? 'All operation histories agree'
                  : 'Some operations have not reached every replica'}
              </span>
            </div>
          </div>
          <div>
            <span>SIMULATED TIME</span>
            <strong>
              {view.now.toLocaleString()} <small>ms</small>
            </strong>
          </div>
          <div>
            <span>IN FLIGHT</span>
            <strong>{view.pending}</strong>
          </div>
          <div>
            <span>DROPPED</span>
            <strong>{view.dropped}</strong>
          </div>
          <div className="play-state">
            <span>{lab.running ? 'RUNNING' : 'PAUSED'}</span>
            <strong>
              {lab.running ? '100 ms / tick' : 'You control time'}
            </strong>
          </div>
        </section>
        <div className="workbench">
          <div className="sidebar">
            <NetworkPanel key={`network-${lab.generation}`} lab={lab} />
            <ScenarioPanel lab={lab} />
          </div>
          <section className="replicas-region" aria-labelledby="replicas-title">
            <div className="section-heading">
              <div>
                <span className="section-number">02</span>
                <h2 id="replicas-title">Your replicas</h2>
              </div>
              <span className="muted small">
                Edit independently · sync through operations
              </span>
            </div>
            <div className="replica-grid">
              {view.replicas.map((replica) => (
                <ReplicaCard
                  key={`${lab.generation}-${replica.id}`}
                  replica={replica}
                  perform={perform}
                />
              ))}
            </div>
            <Timeline key={`timeline-${lab.generation}`} events={view.events} />
          </section>
        </div>
        <details id="guide" className="guide">
          <summary>How replication works</summary>
          <div className="guide-grid">
            <div>
              <h3>01 · Write locally</h3>
              <p>
                Each device owns its state. Every SET or DELETE creates an
                operation and advances its Lamport clock, even when the device
                is offline.
              </p>
            </div>
            <div>
              <h3>02 · Deliver operations</h3>
              <p>
                Run or step the simulation to deliver packets. Sync now queues
                recovery requests; it does not bypass latency, loss or
                partitions.
              </p>
            </div>
            <div>
              <h3>03 · Resolve deterministically</h3>
              <p>
                The largest (logical timestamp, replica ID) wins. Deleted keys
                keep tombstones. Losing writes stay in history; logical time is
                not physical time.
              </p>
            </div>
          </div>
        </details>
        <footer>
          <span>
            ReplicaLab <span aria-hidden="true">/</span> An experiment in
            eventual consistency
          </span>
          <span>In-memory only · Reloading clears this session</span>
        </footer>
      </main>
    </>
  );
}
