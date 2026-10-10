import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'node:path';
import { mkdir } from 'node:fs/promises';

let dbInstance: Database | null = null;

export async function initDb(userDataPath: string): Promise<Database> {
  await mkdir(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, 'multitorrent.sqlite');
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS torrents (
      id TEXT PRIMARY KEY,
      magnet TEXT,
      path TEXT,
      state TEXT
    );
    CREATE TABLE IF NOT EXISTS networks (
      interfaceName TEXT PRIMARY KEY,
      enabled BOOLEAN,
      priority TEXT,
      metered BOOLEAN
    );
  `);

  return dbInstance;
}

export function getDb(): Database {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance;
}

export interface SelectedNetwork {
  interfaceId: string;
  enabled: boolean;
  priority: "high" | "normal" | "low";
  maxDownloadBytesPerSecond?: number;
  maxUploadBytesPerSecond?: number;
  metered: boolean;
}

export async function getSelectedNetworks(): Promise<SelectedNetwork[]> {
  const db = getDb();
  const rows = await db.all('SELECT * FROM networks');
  return rows.map(row => ({
    interfaceId: String(row.interfaceName),
    enabled: Boolean(row.enabled),
    priority: (row.priority as "high" | "normal" | "low") || "normal",
    metered: Boolean(row.metered)
  }));
}

export async function saveSelectedNetwork(network: SelectedNetwork): Promise<void> {
  const db = getDb();
  await db.run(
    'INSERT OR REPLACE INTO networks (interfaceName, enabled, priority, metered) VALUES (?, ?, ?, ?)',
    network.interfaceId,
    network.enabled,
    network.priority,
    network.metered
  );
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows: Array<{ key: string; value: string | null }> =
    await getDb().all('SELECT key, value FROM settings');
  return Object.fromEntries(rows.filter(row => typeof row.value === 'string')
    .map(row => [row.key, row.value as string]));
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await getDb().run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}
