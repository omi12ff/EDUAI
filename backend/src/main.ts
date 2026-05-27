import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = [
        /^http:\/\/localhost:\d+$/i,
        /^http:\/\/127\.0\.0\.1:\d+$/i,
        /^https:\/\/[a-z0-9-]+-\d+\.[a-z0-9-]+\.devtunnels\.ms$/i,
      ];

      if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);

  await app.listen(port, '0.0.0.0');
}
bootstrap().catch(console.error);
