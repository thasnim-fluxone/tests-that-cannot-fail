/**
 * Failure mode 4: asserting a collection is non-empty when it never is.
 *
 * Behaviour: placing an order records each reservation in the audit trail.
 *
 * HOLLOW: asserts the audit trail is not empty. It always contains the
 * inbound entry, so the assertion passes whether or not any reservation
 * was recorded.
 *
 * FIXED: asserts the specific entry the behaviour should produce.
 *
 * Mutation that separates them: an inverted guard makes the service return
 * early, so no reservation is recorded.
 */
import { expect, it } from "vitest";
import { buildService, type AuditEntry, type Order } from "../src/service";
import { Recorder, Transport } from "../src/transport";

const ORDER: Order = {
  id: "o-1",
  lines: [
    { sku: "sku-1", qty: 2 },
    { sku: "sku-2", qty: 1 },
  ],
};

it("hollow: the reservation is audited", () => {
  const audit: AuditEntry[] = [];
  const service = buildService(new Transport(new Recorder()), audit);

  service.placeOrder({}, ORDER);

  expect(audit.length).toBeGreaterThan(0);
});

it("fixed: the reservation is audited", () => {
  const audit: AuditEntry[] = [];
  const service = buildService(new Transport(new Recorder()), audit);

  service.placeOrder({}, ORDER);

  expect(audit).toContainEqual(["reservation", "sku-1"]);
  expect(audit).toContainEqual(["reservation", "sku-2"]);
});
