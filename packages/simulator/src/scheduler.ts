export interface Scheduled<T> {
  readonly id: number;
  readonly at: number;
  readonly value: T;
}

export function assertDuration(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      'Simulated durations must be nonnegative safe integers',
    );
  }
}

/** Integer simulated milliseconds; ties preserve insertion order. No real timers. */
export class Scheduler<T> {
  #now = 0;
  #nextId = 1;
  #queue: Scheduled<T>[] = [];

  get now(): number {
    return this.#now;
  }

  pending(): readonly Scheduled<T>[] {
    return Object.freeze([...this.#queue]);
  }

  schedule(delay: number, value: T): Scheduled<T> {
    assertDuration(delay);
    const at = this.#now + delay;
    assertDuration(at);
    if (!Number.isSafeInteger(this.#nextId))
      throw new RangeError('Scheduler IDs exhausted');
    const event = Object.freeze({ id: this.#nextId++, at, value });
    this.#queue.push(event);
    this.#queue.sort((a, b) => a.at - b.at || a.id - b.id);
    return event;
  }

  step(handle: (event: Scheduled<T>) => void): boolean {
    const event = this.#queue.shift();
    if (!event) return false;
    this.#now = event.at;
    handle(event);
    return true;
  }

  advanceBy(
    duration: number,
    handle: (event: Scheduled<T>) => void,
    maxEvents = 100_000,
  ): number {
    assertDuration(duration);
    const target = this.#now + duration;
    assertDuration(target);
    if (!Number.isSafeInteger(maxEvents) || maxEvents < 1)
      throw new RangeError('Event budget must be a positive safe integer');
    let count = 0;
    while (this.#queue[0] && this.#queue[0].at <= target) {
      if (count >= maxEvents)
        throw new RangeError(
          'Event budget exhausted; advance again from current time',
        );
      this.step(handle);
      count++;
    }
    this.#now = target;
    return count;
  }
}
