import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';

let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
let provisioningClient: ReturnType<typeof postgres> | undefined;
let provisioningDatabase: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada.');
  if (!client) client = postgres(url, { max: 10, prepare: false });
  if (!database) database = drizzle(client, { schema });
  return database;
}

export function getProvisioningDb() {
  const url = process.env.PROVISIONING_DATABASE_URL;
  if (!url) throw new Error('PROVISIONING_DATABASE_URL não configurada.');
  if (!provisioningClient) provisioningClient = postgres(url, { max: 3, prepare: false });
  if (!provisioningDatabase) provisioningDatabase = drizzle(provisioningClient, { schema });
  return provisioningDatabase;
}
