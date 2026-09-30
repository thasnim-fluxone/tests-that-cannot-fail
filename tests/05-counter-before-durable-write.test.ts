/**
 * Failure mode 5: the assertion that looked redundant.
 *
 * Invariant: the log's sequence number advances only after a batch is
 * durably written.
 *
 * HOLLOW: after a failed write, asserts the store is empty. The store is
 * all-or-nothing, so that is true either way. It cannot see the counter
 * drifting ahead of what was actually written.
 *
 * FIXED: also asserts seq is unchanged. This is the assertion an agent may
 * argue is redundant ("the store is already empty, so nothing can be wrong").
 * The mutation is what settles the argument.
 *
 * Mutation that separates them: advance seq per entry, before the write.
 */
import { expect, it } from "vitest";
import { LogWriteError, StockLog, type Entry, type Store } from "../src/stockLog";

class FailingStore implements Store {
  readonly entries: Entry[] = [];

  writeAll(): void {
    throw new LogWriteError("disk full");
  }
}

it("hollow: a failed batch leaves nothing behind", () => {
  const store = new FailingStore();
  const log = new StockLog(store);

  expect(() => log.appendBatch(["in:sku-1", "out:sku-2"])).toThrow(LogWriteError);

  expect(store.entries).toEqual([]);
});

it("fixed: a failed batch leaves nothing behind", () => {
  const store = new FailingStore();
  const log = new StockLog(store);

  expect(() => log.appendBatch(["in:sku-1", "out:sku-2"])).toThrow(LogWriteError);

  expect(store.entries).toEqual([]);
  expect(log.seq).toEqual(0);
});
