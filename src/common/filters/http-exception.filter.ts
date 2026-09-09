import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { colorize, colorForStatus, methodColor } from '../logger/console-color';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolveMessage(exception);
    const method = request.method;
    const url = request.originalUrl || request.url;
    const duration = this.durationOf(request);

    this.logError(method, url, status, message, duration, exception);

    response.status(status).json({
      statusCode: status,
      message,
      path: url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return res;
      }
      const body = res as Record<string, unknown>;
      if (body.message) {
        return body.message as string | string[];
      }
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Internal server error';
  }

  private durationOf(request: Request): number {
    const startedAt = (
      request as unknown as { startedAt?: number }
    ).startedAt;
    return startedAt ? Date.now() - startedAt : 0;
  }

  private logError(
    method: string,
    url: string,
    status: number,
    message: string | string[],
    duration: number,
    exception: unknown,
  ) {
    const color = colorForStatus(status);
    const emoji = status >= 500 ? '💥' : status >= 400 ? '⚠️' : 'ℹ️';
    const messageText = Array.isArray(message) ? message.join(' | ') : message;

    console.error(
      `${emoji} ${colorize(method.padEnd(6), methodColor(method))} ${colorize(
        url,
        'white',
      )} ${colorize(`${status}`, color)} ${colorize(
        duration ? `${duration}ms` : '',
        'dim',
      )} — ${colorize(messageText, color)}`,
    );

    if (status >= 500) {
      console.error(colorize('  └─ stack:', 'dim'));
      const stack =
        exception instanceof Error ? exception.stack : String(exception);
      if (stack) {
        console.error(
          stack
            .split('\n')
            .map((line) => colorize(`     ${line}`, 'dim'))
            .join('\n'),
        );
      }
    }
  }
}