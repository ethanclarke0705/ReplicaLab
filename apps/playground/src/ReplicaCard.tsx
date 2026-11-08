import { useState } from 'react';
import type { ReplicaView } from './session.js';
import type { LabActions } from './useLab.js';

const names: Record<string, string> = { a: 'Laptop', b: 'Tablet', c: 'Phone' };

export function ReplicaCard({
  replica,
  perform,
}: {
  replica: ReplicaView;
  perform: LabActions['perform'];
}) {
  const [key, setKey] = useState('title');
  const [value, setValue] = useState('');
  const [format, setFormat] = useState<'text' | 'json'>('text');
  const [saved, setSaved] = useState('');
  const id = replica.id;
  const label = id.toUpperCase();
  const tombstones = [...replica.winners.values()].filter(
    (op) => op?.type === 'DELETE',
  );
  return (
    <section
      className={`replica-card replica-${id}`}
      aria-labelledby={`replica-${id}`}
    >
      <header className="replica-header">
        <span className="device-mark" aria-hidden="true">
          {label}
        </span>
        <div>
          <h3 id={`replica-${id}`}>Replica {label}</h3>
          <p>{names[id] ?? 'Device'} · independent store</p>
        </div>
        <button
          className={`connection ${replica.connected ? 'online' : 'offline'}`}
          aria-label={`${replica.connected ? 'Disconnect' : 'Reconnect'} replica ${label}`}
          onClick={() =>
            perform((lab) =>
              lab.simulation.setConnected(id, !replica.connected),
            )
          }
        >
          <span aria-hidden="true">●</span>{' '}
          {replica.connected ? 'Online' : 'Offline'}
        </button>
      </header>
      <div className="replica-metrics">
        <span>
          Lamport <strong>{replica.clock}</strong>
        </span>
        <span>
          Local seq. <strong>{replica.sequence}</strong>
        </span>
        <span>
          Ops <strong>{replica.count}</strong>
        </span>
      </div>
      <div className="store">
        <div className="section-kicker">
          LOCAL STATE <span>{replica.entries.length} keys</span>
        </div>
        {replica.entries.length === 0 ? (
          <p className="empty-state">No visible keys. Add a value below.</p>
        ) : (
          <ul className="key-list">
            {replica.entries.map(([entryKey, entryValue]) => (
              <li key={entryKey}>
                <div className="key-value">
                  <code>{entryKey || '(empty key)'}</code>
                  <span>
                    {typeof entryValue === 'string'
                      ? entryValue
                      : JSON.stringify(entryValue)}
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    aria-label={`Edit ${entryKey} on replica ${label}`}
                    onClick={() => {
                      setKey(entryKey);
                      setValue(
                        typeof entryValue === 'string'
                          ? entryValue
                          : JSON.stringify(entryValue),
                      );
                      setFormat(
                        typeof entryValue === 'string' ? 'text' : 'json',
                      );
                      setSaved('Value loaded into editor.');
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="delete-action"
                    aria-label={`Delete ${entryKey} on replica ${label}`}
                    onClick={() => {
                      if (
                        perform((lab) => {
                          lab.simulation.delete(id, entryKey);
                        })
                      )
                        setSaved(`Deleted ${entryKey}. Tombstone retained.`);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {tombstones.length > 0 && (
          <details className="tombstones">
            <summary>
              {tombstones.length} retained tombstone
              {tombstones.length === 1 ? '' : 's'}
            </summary>
            {tombstones.map(
              (op) =>
                op && (
                  <p key={op.id}>
                    <code>{op.key}</code> · DELETE · ({op.logicalTimestamp},{' '}
                    {op.replicaId})
                  </p>
                ),
            )}
          </details>
        )}
      </div>
      <form
        className="edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (perform((lab) => lab.write(id, key, value, format)))
            setSaved(`Saved ${key} locally. Advance time to deliver.`);
        }}
      >
        <div className="editor-heading">
          <span className="section-kicker">LOCAL EDITOR</span>
          <label className="format-label">
            <span className="sr-only">Value format for replica {label}</span>
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value === 'json' ? 'json' : 'text')
              }
            >
              <option value="text">Text</option>
              <option value="json">JSON</option>
            </select>
          </label>
        </div>
        <label htmlFor={`key-${id}`}>
          Key <span className="sr-only">for replica {label}</span>
        </label>
        <input
          id={`key-${id}`}
          value={key}
          maxLength={120}
          required
          onChange={(event) => setKey(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <label htmlFor={`value-${id}`}>
          Value <span className="sr-only">for replica {label}</span>
        </label>
        <textarea
          id={`value-${id}`}
          value={value}
          maxLength={4096}
          rows={2}
          placeholder={
            format === 'json'
              ? '{"done": true}'
              : `Write something on ${names[id] ?? label}…`
          }
          onChange={(event) => setValue(event.target.value)}
          spellCheck={false}
        />
        <button className="save-button" type="submit">
          Save on {label} <span aria-hidden="true">↗</span>
        </button>
        <p className="form-feedback" role="status">
          {saved ||
            (replica.connected
              ? 'Changes are local until packets arrive.'
              : 'Offline writes stay here until reconnection.')}
        </p>
      </form>
      <details className="history">
        <summary>
          Operation history <span>{replica.count}</span>
        </summary>
        <ol>
          {replica.history.map((op) => (
            <li key={op.id}>
              <div>
                <strong>{op.type}</strong> <code>{op.key}</code>{' '}
                <span
                  className={
                    replica.winners.get(op.key)?.id === op.id
                      ? 'winner'
                      : 'muted'
                  }
                >
                  {replica.winners.get(op.key)?.id === op.id
                    ? 'winner'
                    : 'superseded'}
                </span>
              </div>
              <small>
                ({op.logicalTimestamp}, {op.replicaId}) · sequence {op.sequence}
              </small>
              {op.type === 'SET' && <pre>{JSON.stringify(op.value)}</pre>}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
