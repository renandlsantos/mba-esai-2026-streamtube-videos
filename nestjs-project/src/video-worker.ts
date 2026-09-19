import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VideoQueueService } from './videos/video-queue.service';
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  await app.get(VideoQueueService).start();
}
void bootstrap().catch((error) => {
  console.error(
    'Video worker startup failed',
    error instanceof Error ? error.name : 'UnknownError',
  );
  process.exitCode = 1;
});
