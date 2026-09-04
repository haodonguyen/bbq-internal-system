import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ensureUploadDir } from './attachments/upload.config';

async function bootstrap() {
  ensureUploadDir();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
    // The dev auth header. A real deployment sends a cookie or Authorization instead.
    allowedHeaders: ['Content-Type', 'X-User-Id', 'Authorization'],
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on http://localhost:${port}/api`);
}

bootstrap();
