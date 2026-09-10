import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

interface RateRecord {
  count: number;
  resetAt: number;
}

const LIMIT_HEADER = 'X-RateLimit-Limit';
const REMAINING_HEADER = 'X-RateLimit-Remaining';
const RESET_HEADER = 'X-RateLimit-Reset';

/**
 * Minimal fixed-window rate limiter for auth endpoints.
 * In-memory by default (single instance). For horizontal scaling,
 * back this with a shared store (e.g. Redis).
 */
@Injectable()
export class RateLimitService {
  private store = new Map<string, RateRecord>();
  private lastPruneAt = 0;

  isAllowed(key: string, limit: number, ttlMs: number): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    this.pruneIfNeeded(now);

    let record = this.store.get(key);
    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + ttlMs };
      this.store.set(key, record);
    }

    record.count += 1;
    const allowed = record.count <= limit;
    return { allowed, remaining: Math.max(0, limit - record.count), resetAt: record.resetAt };
  }

  private pruneIfNeeded(now: number) {
    if (now - this.lastPruneAt < 60_000 || this.store.size < 10_000) {
      return;
    }
    this.lastPruneAt = now;
    for (const [key, record] of this.store) {
      if (record.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

@Injectable()
export class RateLimitGuard implements NestInterceptor {
  constructor(private readonly rateLimit: RateLimitService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const handler = context.getHandler();
    const controller = context.getClass();
    const options =
      (Reflect.getMetadata('rate_limit_options', handler) as
        | { limit: number; ttlMs: number }
        | undefined) ??
      (Reflect.getMetadata('rate_limit_options', controller) as
        | { limit: number; ttlMs: number }
        | undefined) ?? { limit: 120, ttlMs: 60_000 };

    const key = this.resolveKey(request, options.ttlMs);

    const { allowed, remaining, resetAt } = this.rateLimit.isAllowed(
      key,
      options.limit,
      options.ttlMs,
    );

    response.setHeader(LIMIT_HEADER, options.limit);
    response.setHeader(REMAINING_HEADER, remaining);
    response.setHeader(RESET_HEADER, String(Math.ceil(resetAt / 1000)));

    if (!allowed) {
      response.status(HttpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        message: 'Muitas tentativas. Aguarde um momento e tente novamente.',
        code: 'RATE_LIMITED',
      });
      // Returning a non-observable stops the chain effectively.
      return new Observable((subscriber) => subscriber.complete());
    }

    return next.handle().pipe(
      tap({
        error: (err: unknown) => {
          // no-op: errors are handled by the global exception filter
          void err;
        },
      }),
    );
  }

  private resolveKey(request: Request, ttlMs: number): string {
    const ip =
      request.ip ??
      (request as Request & { socket?: { remoteAddress?: string } }).socket
        ?.remoteAddress ??
      'unknown';

    let suffix = '';
    if (request.path.includes('login')) {
      const body = request.body as { identifier?: string };
      suffix = body?.identifier?.toLowerCase() ?? '';
    }
    if (request.path.includes('register')) {
      const body = request.body as { email?: string };
      suffix = body?.email?.toLowerCase() ?? '';
    }
    return `${ip}:${request.path}:${ttlMs}:${suffix}`;
  }
}