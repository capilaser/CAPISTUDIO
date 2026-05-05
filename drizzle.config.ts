import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/data/schema.ts',
  out: './src-tauri/migrations',
  dialect: 'sqlite',
  verbose: true,
  strict: true,
});
