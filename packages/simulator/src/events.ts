import type { Operation, ReceiveResult } from '@replicalab/core';

export type Payload =
  | { readonly type: 'summary'; readonly knownIds: readonly string[] }
  | { readonly type: 'operation'; readonly operation: Operation };

export interface Packet {
  readonly id: number;
  readonly from: string;
  readonly to: string;
  readonly payload: Payload;
}

export type EventDetail =
  | {
      readonly type: 'sent' | 'delivered' | 'duplicated';
      readonly packet: Packet;
    }
  | { readonly type: 'queued'; readonly packet: Packet; readonly dueAt: number }
  | {
      readonly type: 'dropped';
      readonly packet: Packet;
      readonly reason: 'offline' | 'loss' | 'partition';
    }
  | {
      readonly type: 'node';
      readonly replicaId: string;
      readonly connected: boolean;
    }
  | {
      readonly type: 'link';
      readonly from: string;
      readonly to: string;
      readonly connected: boolean;
    }
  | {
      readonly type: 'local';
      readonly replicaId: string;
      readonly operation: Operation;
    }
  | {
      readonly type: 'received';
      readonly replicaId: string;
      readonly result: ReceiveResult;
    }
  | {
      readonly type: 'rejected';
      readonly packet: Packet;
      readonly reason: string;
    }
  | {
      readonly type: 'reconciliation';
      readonly reason: 'manual' | 'retry' | 'reconnect';
    }
  | { readonly type: 'convergence'; readonly converged: boolean };

export type SimulationEvent = EventDetail & {
  readonly index: number;
  readonly time: number;
};

export class EventJournal {
  readonly #events: SimulationEvent[] = [];

  record(time: number, detail: EventDetail): void {
    this.#events.push(
      Object.freeze({ ...detail, time, index: this.#events.length }),
    );
  }

  snapshot(): readonly SimulationEvent[] {
    return Object.freeze([...this.#events]);
  }
}
