import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

import { ApiErrorResponse } from '../errors/api-error';
import { ErrorCode } from '../errors/error-codes';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, body } = this.resolve(exception as Error);

    response.status(status).json(body);
  }

  private resolve(exception: Error): { status: number; body: ApiErrorResponse } {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        message: 'Algo deu errado. Tente novamente em instantes.',
        code: ErrorCode.INTERNAL_ERROR,
      },
    };
  }

  private resolveHttpException(
    exception: HttpException,
  ): { status: number; body: ApiErrorResponse } {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'object' && response !== null && 'success' in response) {
      return { status, body: response as unknown as ApiErrorResponse };
    }

    const message = this.extractMessage(response);

    return {
      status,
      body: {
        success: false,
        message,
        code: this.codeForStatus(status),
      },
    };
  }

  private resolvePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): { status: number; body: ApiErrorResponse } {
    if (exception.code === 'P2002') {
      const target = Array.isArray(exception.meta?.target)
        ? (exception.meta?.target as string[])
        : [];
      return {
        status: HttpStatus.CONFLICT,
        body: this.conflictBody(target),
      };
    }
    if (exception.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        body: {
          success: false,
          message: 'Registro não encontrado.',
          code: ErrorCode.NOT_FOUND,
        },
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        message: 'Algo deu errado. Tente novamente em instantes.',
        code: ErrorCode.INTERNAL_ERROR,
      },
    };
  }

  private conflictBody(target: string[]): ApiErrorResponse {
    const field = target[0];
    switch (field) {
      case 'email':
        return {
          success: false,
          message: 'Este e-mail já está cadastrado.',
          code: ErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
        };
      case 'username':
        return {
          success: false,
          message: 'Esse nome de usuário já está em uso.',
          code: ErrorCode.AUTH_USERNAME_ALREADY_EXISTS,
        };
      case 'cpf':
        return {
          success: false,
          message: 'Este CPF já está cadastrado.',
          code: ErrorCode.AUTH_CPF_ALREADY_EXISTS,
        };
      case 'phone':
        return {
          success: false,
          message: 'Este telefone já está cadastrado.',
          code: ErrorCode.AUTH_PHONE_ALREADY_EXISTS,
        };
      default:
        return {
          success: false,
          message: 'Já existe um cadastro com os dados informados.',
          code: ErrorCode.VALIDATION_ERROR,
        };
    }
  }

  private extractMessage(response: unknown): string {
    if (typeof response === 'string') {
      return response;
    }
    if (typeof response === 'object' && response !== null) {
      const body = response as Record<string, unknown>;
      const message = body.message;
      if (Array.isArray(message)) {
        return message.join('\n');
      }
      if (typeof message === 'string') {
        return message;
      }
      if (typeof body.error === 'string') {
        return body.error;
      }
    }
    return 'Solicitação inválida.';
  }

  private codeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.AUTH_ACCOUNT_BLOCKED;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}