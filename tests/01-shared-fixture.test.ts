/**
 * Failure mode 1: the fixture makes failure impossible.
 *
 * Behaviour: the service forwards the caller's correlation ID to the supplier.
 *
 * HOLLOW: one Recorder is shared by the test's own caller and by the service's
 * supplier transport. The caller's inbound request already carries the header,
 * so the shared recorder always "sees" it, whether or not the service
 * forwarded anything. The assertion is reasonable; the fixture defeats it.
 *
 * FIXED: each side gets its own recorder, and the assertion looks only at
 * the supplier side.
 *
 * Mutation that separates them: buildService() stops forwarding.
 */
import { expect, it } from "vitest";
import { HEADER } from "../src/correlation";
import { buildService, type Order } from "../src/service";
import { Recorder, Transport } from "../src/transport";

const ORDER: Order = { id: "o-1", lines: [{ sku: "sku-1", qty: 2 }] };

it("hollow: correlation ID reaches the supplier", () => {
  const shared = new Recorder();
  const service = buildService(new Transport(shared));
  const caller = new Transport(shared, (req) => service.handle(req)); // same recorder

  caller.send({ path: "/orders", headers: { [HEADER]: "abc" }, body: ORDER });

  expect(shared.requests.some((r) => r.headers[HEADER] === "abc")).toBe(true);
});

it("fixed: correlation ID reaches the supplier", () => {
  const callerSide = new Recorder();
  const supplierSide = new Recorder();
  const service = buildService(new Transport(supplierSide));
  const caller = new Transport(callerSide, (req) => service.handle(req));

  caller.send({ path: "/orders", headers: { [HEADER]: "abc" }, body: ORDER });

  expect(supplierSide.callCount).toBe(1);
  expect(supplierSide.last()?.headers[HEADER]).toBe("abc");
});
