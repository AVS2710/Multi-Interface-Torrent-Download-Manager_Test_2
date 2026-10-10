import sqlite3 from 'sqlite3';
import fs from 'node:fs/promises';
import { open, Database } from 'sqlite';
import * as path from 'path';

let dbInstance: Database | null = null;

export async function initDb(userDataPath: string): Promise<Database> {
  // Custom Electron --user-data-dir paths used by tests may not exist yet.
  // Create the directory before SQLite attempts to open its database file.
  await fs.mkdir(userDataPath, { recursive: true });
  dbInstance = await open({
    filename: path.join(userDataPath, 'multitorrent.sqlite'),
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
  priority: 'high' | 'normal' | 'low';
  maxDownloadBytesPerSecond?: number;
  maxUploadBytesPerSecond?: number;
  metered: boolean;
}

export async function getSelectedNetworks(): Promise<SelectedNetwork[]> {
  const rows = await getDb().all('SELECT * FROM networks') as {
    interfaceName: string;
    enabled: boolean | number;
    priority: string | null;
    metered: boolean | number;
  }[];

  return rows.map(row => ({
    interfaceId: row.interfaceName,
    enabled: Boolean(row.enabled),
    priority: (row.priority as SelectedNetwork['priority']) || 'normal',
    metered: Boolean(row.metered)
  }));
}

export async function saveSelectedNetwork(network: SelectedNetwork): Promise<void> {
  await getDb().run(
    'INSERT OR REPLACE INTO networks (interfaceName, enabled, priority, metered) VALUES (?, ?, ?, ?)',
    network.interfaceId,
    network.enabled,
    network.priority,
    network.metered
  );
}

export async function getSavedSettings(): Promise<Record<string, string>> {
  const rows = await getDb().all('SELECT key, value FROM settings') as {
    key: string;
    value: string | null;
  }[];

  return Object.fromEntries(rows.map(row => [row.key, row.value ?? '']));
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await getDb().run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    key,
    value
  );
}
