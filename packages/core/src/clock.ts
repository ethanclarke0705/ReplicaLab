/** Lamport time counts accepted events, never wall-clock milliseconds. */
export class LamportClock {
  #value = 0;

  get value(): number {
    return this.#value;
  }

  tick(): number {
    return this.#advance(this.#value);
  }

  receive(timestamp: number): number {
    if (!Number.isSafeInteger(timestamp) || timestamp < 1) {
      throw new TypeError('Timestamp must be a positive safe integer');
    }
    return this.#advance(Math.max(this.#value, timestamp));
  }

  #advance(previous: number): number {
    if (previous >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Lamport clock exhausted');
    }
    this.#value = previous + 1;
    return this.#value;
  }
}
