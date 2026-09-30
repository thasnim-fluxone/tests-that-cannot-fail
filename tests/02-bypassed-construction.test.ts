/**
 * Failure mode 2: the test builds its own object graph.
 *
 * Behaviour: the service forwards the caller's correlation ID to the supplier.
 *
 * HOLLOW: constructs SupplierClient and InventoryService by hand, with
 * forwarding switched on. It exercises real code, but not the code that
 * ships: production only ever builds the service through buildService().
 *
 * FIXED: goes through buildService(), exactly as production does.
 *
 * Mutation that separates them: buildService() stops forwarding.
 */
import { expect, it } from "vitest";
import { HEADER } from "../src/correlation";
import { buildService, InventoryService, type Order } from "../src/service";
import { SupplierClient } from "../src/supplier";
import { Recorder, Transport } from "../src/transport";

const ORDER: Order = { id: "o-1", lines: [{ sku: "sku-1", qty: 2 }] };

it("hollow: forwards the correlation ID", () => {
  const rec = new Recorder();
  const supplier = new SupplierClient(new Transport(rec), { forwardCorrelation: true });
  const service = new InventoryService(supplier, []);

  service.placeOrder({ [HEADER]: "abc" }, ORDER);

  expect(rec.last()?.headers[HEADER]).toBe("abc");
});

it("fixed: forwards the correlation ID", () => {
  const rec = new Recorder();
  const service = buildService(new Transport(rec));

  service.placeOrder({ [HEADER]: "abc" }, ORDER);

  expect(rec.last()?.headers[HEADER]).toBe("abc");
});
