// Correlation-ID rule: forward the caller's ID on outbound calls,
// but only if the caller sent one. Never invent an ID of our own.
import type { HeaderMap } from "./transport";

export const HEADER = "X-Correlation-ID";

export function outboundHeaders(inbound: HeaderMap, forward: boolean): HeaderMap {
  if (forward && HEADER in inbound) {
    return { [HEADER]: inbound[HEADER] };
  }
  return {};
}
