// Minimal HTTP-like transport for the sample inventory service.
// Every request sent through a Transport is recorded on its Recorder,
// so tests can inspect exactly what went over the wire.

export type HeaderMap = Record<string, string>;

export interface Request {
  path: string;
  headers: HeaderMap;
  body: unknown;
}

export class Recorder {
  readonly requests: Request[] = [];

  record(request: Request): void {
    this.requests.push(request);
  }

  get callCount(): number {
    return this.requests.length;
  }

  last(): Request | undefined {
    return this.requests.at(-1);
  }
}

export class Transport {
  constructor(
    private readonly recorder: Recorder,
    private readonly handler?: (request: Request) => unknown,
  ) {}

  send(request: Request): unknown {
    this.recorder.record(request);
    return this.handler ? this.handler(request) : {};
  }
}
