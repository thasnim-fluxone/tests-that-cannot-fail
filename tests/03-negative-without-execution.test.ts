/**
 * Failure mode 3: a negative assertion with no proof the code ran.
 *
 * Behaviour: if the caller sends no correlation ID, the service must not
 * invent one on outbound calls.
 *
 * HOLLOW: asserts that no outbound request carries the header. some() over
 * an empty array is false, so if the supplier is never called, the assertion
 * passes anyway. "Nothing was sent" and "nothing wrong was sent" look the same.
 *
 * FIXED: first proves the calls happened, then asserts the header is absent.
 *
 * Mutation that separates them: an inverted guard makes the service return
 * early, so the supplier is never called.
 */
import { expect, it } from "vitest";
import { HEADER } from "../src/correlation";
import { buildService, type Order } from "../src/service";
import { Recorder, Transport } from "../src/transport";

const ORDER: Order = {
  id: "o-1",
  lines: [
    { sku: "sku-1", qty: 2 },
    { sku: "sku-2", qty: 1 },
  ],
};

it("hollow: no correlation ID is invented", () => {
  const rec = new Recorder();
  const service = buildService(new Transport(rec));

  service.placeOrder({}, ORDER);

  expect(rec.requests.some((r) => HEADER in r.headers)).toBe(false);
});

it("fixed: no correlation ID is invented", () => {
  const rec = new Recorder();
  const service = buildService(new Transport(rec));

  service.placeOrder({}, ORDER);

  expect(rec.callCount).toBe(ORDER.lines.length); // prove the path executed
  expect(rec.requests.some((r) => HEADER in r.headers)).toBe(false);
});
