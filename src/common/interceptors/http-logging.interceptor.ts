import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

import { colorize, colorForStatus, methodColor } from '../logger/console-color';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isHttp = context.getType() === 'http';
    if (!isHttp) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();
    const method = request.method;
    const url = request.originalUrl || request.url;

    return next.handle().pipe(
      tap({
        next: () => this.logSuccess(method, url, response.statusCode, startedAt),
      }),
    );
  }

  private logSuccess(
    method: string,
    url: string,
    status: number,
    startedAt: number,
  ) {
    const duration = Date.now() - startedAt;
    const color = colorForStatus(status);
    const emoji = status >= 200 && status < 300 ? '✅' : '⏩';

    console.log(
      `${colorize(method.padEnd(6), methodColor(method))} ${colorize(
        url,
        'white',
      )} ${colorize(`${status}`, color)} ${colorize(
        `${duration}ms`,
        'dim',
      )} ${emoji}`,
    );
  }
}