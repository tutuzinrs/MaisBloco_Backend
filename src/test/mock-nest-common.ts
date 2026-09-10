/**
 * Minimal runtime facade for `@nestjs/common`, used only by unit tests.
 *
 * NestJS 12 (and bcryptjs 3) ship ESM-only builds that the CJS Jest runtime on
 * Node < 24.9 cannot `require()`. Service specs that don't need real framework
 * internals can swap the module with this facade via `jest.mock`.
 */
export class HttpException {
  public response: unknown;
  public status: number;

  constructor(response: unknown, status: number) {
    this.response = response;
    this.status = status;
  }

  getResponse(): unknown {
    return this.response;
  }

  getStatus(): number {
    return this.status;
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export const HttpStatus = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const Injectable = () => () => {};
export const Controller = () => () => {};
export const Get = () => () => {};

export class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  log(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
  verbose(): void {}
  setContext(): void {
    void this.context;
  }
}