import type { SimulationEvent } from '@replicalab/simulator';

export type EventFilter =
  'activity' | 'all' | 'operations' | 'network' | 'superseded';

export function eventTitle(event: SimulationEvent): string {
  if ('packet' in event) {
    const { packet } = event;
    const content =
      packet.payload.type === 'summary'
        ? 'summary'
        : `${packet.payload.operation.type} “${packet.payload.operation.key}”`;
    return `${packet.from.toUpperCase()} → ${packet.to.toUpperCase()} · ${content}`;
  }
  switch (event.type) {
    case 'local':
      return `${event.replicaId.toUpperCase()} · ${event.operation.type} “${event.operation.key}”`;
    case 'received':
      return `${event.replicaId.toUpperCase()} · ${event.result.operation.type} “${event.result.operation.key}” ${event.result.status}`;
    case 'node':
      return `Replica ${event.replicaId.toUpperCase()} ${event.connected ? 'reconnected' : 'disconnected'}`;
    case 'link':
      return `Link ${event.from.toUpperCase()} ↔ ${event.to.toUpperCase()} ${event.connected ? 'restored' : 'partitioned'}`;
    case 'convergence':
      return event.converged
        ? 'All operation histories agree'
        : 'Replica histories have diverged';
    case 'reconciliation':
      return `${event.reason} recovery round`;
  }
}

export function eventMatches(
  event: SimulationEvent,
  filter: EventFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'superseded')
    return event.type === 'received' && event.result.status === 'superseded';
  if (filter === 'operations')
    return ['local', 'received', 'rejected'].includes(event.type);
  if (filter === 'network')
    return (
      'packet' in event ||
      ['node', 'link', 'reconciliation'].includes(event.type)
    );
  return (
    !['sent', 'queued'].includes(event.type) &&
    !(event.type === 'reconciliation' && event.reason === 'retry') &&
    !('packet' in event && event.packet.payload.type === 'summary')
  );
}

export function eventExplanation(event: SimulationEvent): string {
  switch (event.type) {
    case 'received': {
      const { operation, winner, status } = event.result;
      if (status === 'duplicate')
        return 'This operation was already known. Duplicate delivery changed neither the replica state nor its logical clock.';
      if (status === 'applied')
        return `Accepted as the winner for this key at this replica. Its ordering tuple is (${winner.logicalTimestamp}, ${winner.replicaId}).`;
      const reason =
        winner.logicalTimestamp > operation.logicalTimestamp
          ? 'a greater logical timestamp'
          : 'a greater replica ID at the same logical timestamp';
      return `The received operation (${operation.logicalTimestamp}, ${operation.replicaId}) lost to (${winner.logicalTimestamp}, ${winner.replicaId}): ${reason}. ${winner.type === 'DELETE' ? 'The winning tombstone keeps the key deleted.' : 'The winning SET remains visible.'} The losing operation stays in history. This alone does not prove the edits were concurrent.`;
    }
    case 'local':
      return 'A real local operation was created. Its logical clock advanced; outgoing packets still need delivery before other replicas can learn it.';
    case 'dropped':
      return `This packet was dropped because of ${event.reason}. Periodic reconciliation can recover it only after the required messages get through.`;
    case 'queued':
      return `Scheduled for ${event.dueAt} simulated ms. Changing conditions affects new sends; breaking this route can still discard the queued packet.`;
    case 'rejected':
      return `The engine rejected this operation: ${event.reason}`;
    case 'convergence':
      return event.converged
        ? 'Every replica has the same complete operation history, including tombstones and losing writes. Their Lamport clocks may still differ.'
        : 'At least one replica has a different operation history. Successful delivery and recovery are needed to reach agreement.';
    case 'reconciliation':
      return 'Known-operation summaries are sent through the simulated network. Missing operations return as ordinary packets, subject to the same faults.';
    case 'node':
      return event.connected
        ? 'The device is online again and recovery has been requested. Advance simulated time to deliver packets.'
        : 'The device is isolated, but local writes still work. Reconnect it to allow recovery.';
    case 'link':
      return event.connected
        ? 'This bidirectional link is open. Recovery is requested through the ordinary transport.'
        : 'This link is partitioned in both directions. Other paths may still forward operations.';
    case 'sent':
      return 'A packet send was attempted. The transport decides whether to drop or schedule it.';
    case 'delivered':
      return 'The packet reached its recipient through the scheduler. Operation application is recorded separately as a received event.';
    case 'duplicated':
      return 'An extra packet copy was created. Both copies carry the same payload, and each can be delayed or lost independently.';
  }
}
