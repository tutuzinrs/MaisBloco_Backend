import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../interfaces/auth.types';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (req.user?.role !== 1) {
      throw new ForbiddenException('Acesso restrito a administradores.');
    }

    return true;
  }
}