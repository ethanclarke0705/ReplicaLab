import { useState } from 'react';
import type { LabActions } from './useLab.js';

export function NetworkPanel({ lab }: { lab: LabActions }) {
  const { view, perform } = lab;
  const [latency, setLatency] = useState(String(view.conditions.latency));
  const [jitter, setJitter] = useState(String(view.conditions.jitter));
  const [loss, setLoss] = useState(String(view.conditions.loss * 100));
  const [duplication, setDuplication] = useState(
    String(view.conditions.duplication * 100),
  );
  const [applied, setApplied] = useState(false);
  const fields = [
    {
      id: 'latency',
      label: 'Latency',
      suffix: 'ms',
      value: latency,
      set: setLatency,
      max: 5000,
    },
    {
      id: 'jitter',
      label: 'Jitter',
      suffix: 'ms',
      value: jitter,
      set: setJitter,
      max: 5000,
    },
    {
      id: 'loss',
      label: 'Packet loss',
      suffix: '%',
      value: loss,
      set: setLoss,
      max: 100,
    },
    {
      id: 'duplication',
      label: 'Duplication',
      suffix: '%',
      value: duplication,
      set: setDuplication,
      max: 100,
    },
  ];
  return (
    <aside className="network-panel panel" aria-labelledby="network-title">
      <div className="panel-heading">
        <span className="section-number">01</span>
        <h2 id="network-title">Network conditions</h2>
      </div>
      <p className="muted small">Change the network. See what survives.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            perform((session) =>
              session.simulation.network.configure({
                latency: Number(latency),
                jitter: Number(jitter),
                loss: Number(loss) / 100,
                duplication: Number(duplication) / 100,
              }),
            )
          )
            setApplied(true);
        }}
      >
        {fields.map((field) => (
          <label className="network-field" key={field.id} htmlFor={field.id}>
            <span>{field.label}</span>
            <span className="number-input">
              <input
                id={field.id}
                type="number"
                min={0}
                max={field.max}
                step={1}
                required
                value={field.value}
                onChange={(event) => {
                  field.set(event.target.value);
                  setApplied(false);
                }}
              />
              <span>{field.suffix}</span>
            </span>
          </label>
        ))}
        <button type="submit" className="secondary full">
          Apply conditions
        </button>
        <p className="small muted" role="status">
          {applied
            ? 'Applied to new packets.'
            : 'Jitter can deliver messages out of order.'}
        </p>
      </form>
      <div className="link-controls">
        <div className="section-kicker">BIDIRECTIONAL LINKS</div>
        {view.links.map((link) => (
          <button
            key={`${link.from}:${link.to}`}
            className={`link-button ${link.open ? '' : 'broken'}`}
            aria-label={`${link.open ? 'Partition' : 'Restore'} link ${link.from.toUpperCase()}–${link.to.toUpperCase()}`}
            onClick={() =>
              perform((session) =>
                session.simulation.setLink(link.from, link.to, !link.open),
              )
            }
          >
            <span>
              {link.from.toUpperCase()} <span aria-hidden="true">↔</span>{' '}
              {link.to.toUpperCase()}
            </span>
            <span>{link.open ? 'Connected' : 'Partitioned'}</span>
          </button>
        ))}
      </div>
      <div className="network-footnote">
        <span aria-hidden="true">↻</span>
        <p>
          Recovery retries use the same lossy network. A partition can prevent
          convergence.
        </p>
      </div>
    </aside>
  );
}
