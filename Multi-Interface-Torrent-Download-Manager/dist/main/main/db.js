import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
let dbInstance = null;
export async function initDb(userDataPath) {
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
export function getDb() {
    if (!dbInstance)
        throw new Error('Database not initialized');
    return dbInstance;
}
export async function getSelectedNetworks() {
    const db = getDb();
    const rows = await db.all('SELECT * FROM networks');
    return rows.map(row => ({
        interfaceId: row.interfaceName,
        enabled: Boolean(row.enabled),
        priority: row.priority || "normal",
        metered: Boolean(row.metered)
    }));
}
export async function saveSelectedNetwork(network) {
    const db = getDb();
    await db.run('INSERT OR REPLACE INTO networks (interfaceName, enabled, priority, metered) VALUES (?, ?, ?, ?)', network.interfaceId, network.enabled, network.priority, network.metered);
}
