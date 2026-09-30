import { SupplierClient } from "./supplier";
import type { HeaderMap, Request, Transport } from "./transport";

export interface Order {
  id: string;
  lines: { sku: string; qty: number }[];
}

export type AuditEntry = [kind: string, value: string];

export class InventoryService {
  constructor(
    private readonly supplier: SupplierClient,
    private readonly audit: AuditEntry[],
  ) {}

  /** Entry point for an inbound order request. */
  handle(request: Request): unknown {
    return this.placeOrder(request.headers, request.body as Order);
  }

  placeOrder(inbound: HeaderMap, order: Order): { status: string } {
    this.audit.push(["inbound", order.id]);
    if (order.lines.length === 0) {
      return { status: "empty" };
    }
    for (const [i, line] of order.lines.entries()) {
      // Only the first reservation of an order carries the parent ID.
      const parent = i === 0 ? order.id : undefined;
      this.supplier.reserve(inbound, line.sku, line.qty, parent);
      this.audit.push(["reservation", line.sku]);
    }
    return { status: "placed" };
  }
}

/** The only way production constructs the service. */
export function buildService(supplierTransport: Transport, audit: AuditEntry[] = []): InventoryService {
  const supplier = new SupplierClient(supplierTransport, { forwardCorrelation: true });
  return new InventoryService(supplier, audit);
}
