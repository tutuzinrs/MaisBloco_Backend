export interface ThrottleOptions {
  limit: number;
  ttlMs: number;
}

export const RATE_LIMIT_KEY = 'rate_limit_options';

export const DEFAULT_THROTTLE: ThrottleOptions = { limit: 120, ttlMs: 60000 };

/**
 * Decorator that sets per-route/controller rate limiting options.
 * Applied together with `RateLimitGuard`.
 */
export function Throttle(options: ThrottleOptions): MethodDecorator & ClassDecorator {
  return ((
    target: object,
    _propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, options, descriptor?.value ?? target);
  }) as MethodDecorator & ClassDecorator;
}