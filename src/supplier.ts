import { outboundHeaders } from "./correlation";
import type { HeaderMap, Transport } from "./transport";

export interface ReservationBody {
  sku: string;
  qty: number;
  parentOrderId?: string;
}

export class SupplierClient {
  constructor(
    private readonly transport: Transport,
    private readonly options: { forwardCorrelation: boolean },
  ) {}

  reserve(inbound: HeaderMap, sku: string, qty: number, parentOrderId?: string): unknown {
    const headers = outboundHeaders(inbound, this.options.forwardCorrelation);
    const body: ReservationBody = { sku, qty };
    if (parentOrderId !== undefined) {
      body.parentOrderId = parentOrderId;
    }
    return this.transport.send({ path: "/reserve", headers, body });
  }
}
