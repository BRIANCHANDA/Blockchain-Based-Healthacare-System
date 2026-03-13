import { OpenAPIHono } from '@hono/zod-openapi';

export function createRouter() {
  return new OpenAPIHono();
}

export function createApp() {
  const app = new OpenAPIHono();
  return app;
}
