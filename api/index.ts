import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HttpLoggingInterceptor } from '../src/common/interceptors/http-logging.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

let app: any;

async function bootstrap() {
  const nestApp = await NestFactory.create(AppModule);

  nestApp.use((req: Request, res: Response, next: NextFunction) => {
    (req as unknown as { startedAt: number }).startedAt = Date.now();
    next();
  });

  nestApp.enableCors({
    origin: true,
    credentials: true,
  });

  nestApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  nestApp.useGlobalInterceptors(new HttpLoggingInterceptor());
  nestApp.useGlobalFilters(new AllExceptionsFilter());

  nestApp.setGlobalPrefix('api');

  await nestApp.init();

  return nestApp;
}

export default async function handler(
  req: Request,
  res: Response,
) {
  if (!app) {
    app = await bootstrap();
  }

  const instance = app.getHttpAdapter().getInstance();

  return instance(req, res);
}