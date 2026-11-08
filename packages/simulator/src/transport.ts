import { parseOperation } from '@replicalab/core';
import { EventJournal, type Packet, type Payload } from './events.js';
import { SeededRandom } from './random.js';
import { assertDuration, Scheduler } from './scheduler.js';

export interface NetworkConditions {
  readonly latency: number;
  readonly jitter: number;
  readonly loss: number;
  readonly duplication: number;
}

export interface SendOptions {
  readonly delay?: number;
  readonly drop?: boolean;
  readonly duplicate?: boolean;
}

interface Node {
  readonly receive: (packet: Packet) => void;
  connected: boolean;
  epoch: number;
}

/** Packet delivery knows endpoints and messages, never replica state. */
export class Transport {
  readonly #clock: Scheduler<() => void>;
  readonly #journal: EventJournal;
  readonly #random: SeededRandom;
  readonly #nodes = new Map<string, Node>();
  readonly #links = new Map<string, { connected: boolean; epoch: number }>();
  readonly #pending = new Map<number, Packet>();
  #nextPacket = 1;
  #conditions: NetworkConditions = Object.freeze({
    latency: 10,
    jitter: 0,
    loss: 0,
    duplication: 0,
  });

  constructor(
    clock: Scheduler<() => void>,
    journal: EventJournal,
    seed = 1,
    conditions: Partial<NetworkConditions> = {},
  ) {
    this.#clock = clock;
    this.#journal = journal;
    this.#random = new SeededRandom(seed);
    this.configure(conditions);
  }

  get conditions(): NetworkConditions {
    return this.#conditions;
  }
  pending(): readonly Packet[] {
    return Object.freeze([...this.#pending.values()]);
  }

  configure(change: Partial<NetworkConditions>): void {
    const next = { ...this.#conditions, ...change };
    assertDuration(next.latency);
    assertDuration(next.jitter);
    assertDuration(next.latency + next.jitter);
    for (const probability of [next.loss, next.duplication]) {
      if (!Number.isFinite(probability) || probability < 0 || probability > 1)
        throw new RangeError('Probabilities must be between zero and one');
    }
    this.#conditions = Object.freeze(next);
  }

  register(id: string, receive: (packet: Packet) => void): void {
    if (!id || this.#nodes.has(id))
      throw new TypeError('Endpoint IDs must be nonempty and unique');
    this.#nodes.set(id, { receive, connected: true, epoch: 0 });
  }

  isConnected(id: string): boolean {
    return this.#node(id).connected;
  }

  setConnected(id: string, connected: boolean): void {
    const node = this.#node(id);
    if (node.connected === connected) return;
    node.connected = connected;
    node.epoch++;
    this.#journal.record(this.#clock.now, {
      type: 'node',
      replicaId: id,
      connected,
    });
  }

  setLink(from: string, to: string, connected: boolean): void {
    this.#node(from);
    this.#node(to);
    if (from === to) throw new TypeError('Links require different endpoints');
    const key = this.#linkKey(from, to);
    const previous = this.#links.get(key);
    if ((previous?.connected ?? true) === connected) return;
    this.#links.set(key, { connected, epoch: (previous?.epoch ?? 0) + 1 });
    this.#journal.record(this.#clock.now, {
      type: 'link',
      from,
      to,
      connected,
    });
  }

  send(
    from: string,
    to: string,
    input: Payload,
    options: SendOptions = {},
  ): void {
    this.#node(from);
    this.#node(to);
    if (from === to) throw new TypeError('Packets require different endpoints');
    if (options.delay !== undefined) assertDuration(options.delay);
    const payload = this.#copyPayload(input);
    // Both possible deadlines are validated before any queue/log/random mutation.
    assertDuration(
      this.#clock.now +
        (options.delay ?? this.#conditions.latency + this.#conditions.jitter),
    );
    const duplicate =
      options.duplicate ?? this.#random.next() < this.#conditions.duplication;
    this.#sendCopy(from, to, payload, options, false);
    if (duplicate) this.#sendCopy(from, to, payload, options, true);
  }

  #sendCopy(
    from: string,
    to: string,
    payload: Payload,
    options: SendOptions,
    duplicate: boolean,
  ): void {
    const packet = Object.freeze({ id: this.#nextPacket++, from, to, payload });
    this.#journal.record(this.#clock.now, {
      type: duplicate ? 'duplicated' : 'sent',
      packet,
    });
    const offline = !this.#node(from).connected || !this.#node(to).connected;
    const partition = !(
      this.#links.get(this.#linkKey(from, to))?.connected ?? true
    );
    const loss = options.drop ?? this.#random.next() < this.#conditions.loss;
    if (offline || partition || loss) {
      this.#journal.record(this.#clock.now, {
        type: 'dropped',
        packet,
        reason: offline ? 'offline' : partition ? 'partition' : 'loss',
      });
      return;
    }
    const delay =
      options.delay ??
      this.#conditions.latency +
        Math.floor(this.#random.next() * (this.#conditions.jitter + 1));
    const epoch = this.#routeEpoch(from, to);
    this.#clock.schedule(delay, () => {
      this.#pending.delete(packet.id);
      if (epoch !== this.#routeEpoch(from, to)) {
        this.#journal.record(this.#clock.now, {
          type: 'dropped',
          packet,
          reason: 'partition',
        });
        return;
      }
      this.#journal.record(this.#clock.now, { type: 'delivered', packet });
      this.#node(to).receive(packet);
    });
    this.#pending.set(packet.id, packet);
    this.#journal.record(this.#clock.now, {
      type: 'queued',
      packet,
      dueAt: this.#clock.now + delay,
    });
  }

  #copyPayload(payload: Payload): Payload {
    if (payload.type === 'operation')
      return Object.freeze({
        type: 'operation',
        operation: parseOperation(payload.operation),
      });
    if (
      payload.type !== 'summary' ||
      !Array.isArray(payload.knownIds) ||
      ![...payload.knownIds].every((id) => typeof id === 'string')
    )
      throw new TypeError('Invalid summary payload');
    return Object.freeze({
      type: 'summary',
      knownIds: Object.freeze([...payload.knownIds]),
    });
  }

  #node(id: string): Node {
    const node = this.#nodes.get(id);
    if (!node) throw new TypeError(`Unknown endpoint: ${id}`);
    return node;
  }

  #linkKey(from: string, to: string): string {
    return JSON.stringify([from, to].sort());
  }
  #routeEpoch(from: string, to: string): string {
    return JSON.stringify([
      this.#node(from).epoch,
      this.#node(to).epoch,
      this.#links.get(this.#linkKey(from, to))?.epoch ?? 0,
    ]);
  }
}
