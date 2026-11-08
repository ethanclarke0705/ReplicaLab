import { useMemo, useState } from 'react';
import type { SimulationEvent } from '@replicalab/simulator';
import {
  eventExplanation,
  eventMatches,
  eventTitle,
  type EventFilter,
} from './eventPresentation.js';

const filters: { value: EventFilter; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'all', label: 'All events' },
  { value: 'operations', label: 'Operations' },
  { value: 'network', label: 'Network' },
  { value: 'superseded', label: 'Superseded writes' },
];

export function Timeline({ events }: { events: readonly SimulationEvent[] }) {
  const [filter, setFilter] = useState<EventFilter>('activity');
  const [query, setQuery] = useState('');
  const [oldest, setOldest] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const matching = useMemo(
    () =>
      events.filter(
        (event) =>
          eventMatches(event, filter) &&
          (!query ||
            JSON.stringify(event).toLowerCase().includes(query.toLowerCase())),
      ),
    [events, filter, query],
  );
  const visible = oldest
    ? matching.slice(0, 200)
    : matching.slice(-200).reverse();
  const selected =
    matching.find((event) => event.index === selectedIndex) ?? visible[0];
  const operation =
    selected &&
    (selected.type === 'local'
      ? selected.operation
      : selected.type === 'received'
        ? selected.result.operation
        : 'packet' in selected && selected.packet.payload.type === 'operation'
          ? selected.packet.payload.operation
          : undefined);
  return (
    <section className="timeline-section" aria-labelledby="timeline-title">
      <div className="section-heading">
        <div>
          <span className="section-number">03</span>
          <h2 id="timeline-title">Event timeline</h2>
          <span className="count-badge">{events.length}</span>
        </div>
        <span className="small muted">
          Every entry comes from the simulator
        </span>
      </div>
      <div className="timeline-layout">
        <div className="event-panel">
          <div className="timeline-toolbar">
            <label>
              <span className="sr-only">Event filter</span>
              <select
                value={filter}
                onChange={(event) => {
                  const choice = filters.find(
                    (item) => item.value === event.target.value,
                  );
                  if (choice) {
                    setFilter(choice.value);
                    setSelectedIndex(null);
                  }
                }}
              >
                {filters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="event-search">
              <span className="sr-only">Search events</span>
              <input
                type="search"
                placeholder="Search key, replica or operation…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(null);
                }}
              />
            </label>
            <button className="order-button" onClick={() => setOldest(!oldest)}>
              {oldest ? 'Oldest first ↑' : 'Newest first ↓'}
            </button>
          </div>
          <div
            className="event-list"
            role="region"
            aria-label="Matching events"
            tabIndex={0}
          >
            {visible.length === 0 ? (
              <div className="timeline-empty">
                <strong>No matching events</strong>
                <p>
                  Try another filter or search. Superseded writes appear when an
                  older operation loses resolution.
                </p>
              </div>
            ) : (
              <ol>
                {visible.map((event) => (
                  <li key={event.index}>
                    <button
                      className={`event-row ${selected?.index === event.index ? 'selected' : ''}`}
                      aria-pressed={selected?.index === event.index}
                      onClick={() => setSelectedIndex(event.index)}
                    >
                      <span className="event-time">
                        {event.time} <small>ms</small>
                      </span>
                      <span className={`event-type type-${event.type}`}>
                        {event.type}
                      </span>
                      <span className="event-title">{eventTitle(event)}</span>
                      <span className="event-index">#{event.index}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="timeline-footer">
            Showing {visible.length} of {matching.length} matching events ·{' '}
            {oldest ? 'earliest' : 'latest'} 200 maximum
          </div>
        </div>
        <aside className="event-inspector" aria-labelledby="inspector-title">
          <div className="inspector-heading">
            <h3 id="inspector-title">Event details</h3>
            <span>{selected ? `#${selected.index}` : '—'}</span>
          </div>
          {selected ? (
            <>
              <p className="inspector-title">{eventTitle(selected)}</p>
              <p className="explanation">{eventExplanation(selected)}</p>
              {operation && (
                <dl className="operation-metadata">
                  <div>
                    <dt>Operation ID</dt>
                    <dd>{operation.id}</dd>
                  </div>
                  <div>
                    <dt>Origin</dt>
                    <dd>Replica {operation.replicaId.toUpperCase()}</dd>
                  </div>
                  <div>
                    <dt>Local sequence</dt>
                    <dd>{operation.sequence}</dd>
                  </div>
                  <div>
                    <dt>Logical time</dt>
                    <dd>{operation.logicalTimestamp}</dd>
                  </div>
                  <div>
                    <dt>Action</dt>
                    <dd>
                      {operation.type} {operation.key}
                    </dd>
                  </div>
                  {operation.type === 'SET' && (
                    <div>
                      <dt>Value</dt>
                      <dd>{JSON.stringify(operation.value)}</dd>
                    </div>
                  )}
                </dl>
              )}
              <details className="raw-event">
                <summary>Raw event JSON</summary>
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p className="explanation">
              Select an event to inspect its operation and delivery metadata.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
