import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: ErrorCode;
  details?: unknown;
}

export class ApiError extends HttpException {
  readonly code: ErrorCode;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: unknown,
  ) {
    const body: ApiErrorResponse = { success: false, message, code };
    if (details !== undefined) {
      body.details = details;
    }
    super(body, status);
    this.code = code;
  }
}