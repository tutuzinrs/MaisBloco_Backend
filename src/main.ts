import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use((req: Request, res: Response, next: NextFunction) => {
    (req as unknown as { startedAt: number }).startedAt = Date.now();
    next();
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();