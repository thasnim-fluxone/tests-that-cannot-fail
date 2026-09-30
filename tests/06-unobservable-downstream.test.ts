/**
 * Failure mode 6: the downstream system hides the behaviour.
 *
 * Behaviour: only the first reservation of an order carries parentOrderId.
 *
 * HOLLOW (integration style): checks what the supplier recorded. But this
 * fake supplier, like many real ones, keeps the parent from the first call
 * and ignores it afterwards. Sending it on every call changes nothing the
 * supplier exposes, so the test cannot tell the difference. The test is not
 * wrong; it is looking where the behaviour is invisible.
 *
 * FIXED (unit style): asserts on the outbound requests themselves.
 *
 * Mutation that separates them: send parentOrderId on every reservation.
 */
import { expect, it } from "vitest";
import { buildService, type Order } from "../src/service";
import type { ReservationBody } from "../src/supplier";
import { Recorder, Transport, type Request } from "../src/transport";

const ORDER: Order = {
  id: "o-1",
  lines: [
    { sku: "sku-1", qty: 2 },
    { sku: "sku-2", qty: 1 },
  ],
};

/** Keeps the parent from the first reservation; ignores it afterwards. */
class FakeSupplier {
  parent: string | undefined;
  reservations = 0;

  handle(request: Request): unknown {
    const body = request.body as ReservationBody;
    if (this.parent === undefined && body.parentOrderId !== undefined) {
      this.parent = body.parentOrderId;
    }
    this.reservations += 1;
    return { ok: true };
  }
}

it("hollow: the parent is set once", () => {
  const supplier = new FakeSupplier();
  const service = buildService(new Transport(new Recorder(), (req) => supplier.handle(req)));

  service.placeOrder({}, ORDER);

  expect(supplier.reservations).toBe(2);
  expect(supplier.parent).toBe("o-1");
});

it("fixed: the parent is only on the first reservation", () => {
  const rec = new Recorder();
  const service = buildService(new Transport(rec));

  service.placeOrder({}, ORDER);

  const bodies = rec.requests.map((r) => r.body as ReservationBody);
  expect(bodies).toHaveLength(2);
  expect(bodies[0].parentOrderId).toBe("o-1");
  expect(bodies[1]).not.toHaveProperty("parentOrderId");
});
