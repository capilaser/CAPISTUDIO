import type { Config } from 'drizzle-kit';

export default {
  schema: './src/data/schema.ts',
  out: './src-tauri/migrations',
  dialect: 'sqlite',
  driver: 'durable-sqlite',
  verbose: true,
  strict: true,
} satisfies Config;
