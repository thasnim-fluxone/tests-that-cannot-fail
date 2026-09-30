export class LogWriteError extends Error {}

export type Entry = [seq: number, movement: string];

export interface Store {
  writeAll(entries: Entry[]): void;
}

export class InMemoryStore implements Store {
  readonly entries: Entry[] = [];

  writeAll(entries: Entry[]): void {
    this.entries.push(...entries); // all-or-nothing
  }
}

/**
 * Append-only log of stock movements with a sequence number.
 * Invariant: seq advances only after a batch is durably written.
 */
export class StockLog {
  #seq = 0;

  constructor(private readonly store: Store) {}

  get seq(): number {
    return this.#seq;
  }

  appendBatch(movements: string[]): void {
    const entries: Entry[] = movements.map((m, i) => [this.#seq + i, m]);
    this.store.writeAll(entries);
    this.#seq += entries.length;
  }
}
