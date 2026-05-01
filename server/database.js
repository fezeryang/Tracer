
import { BigQuery } from '@google-cloud/bigquery';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

// State
let dbType = 'NONE'; // 'BIGQUERY' | 'SQLITE'
let bqClient = null;
let sqliteDb = null;
let isDBReady = false;

const DATASET_ID = 'volt_db';
const TABLE_FEEDBACK = 'feedback';
const TABLE_USERS = 'users';
const TABLE_SESSIONS = 'sessions';

export async function initDB() {
  console.log('[Database] Initializing...');

  // 1. Try BigQuery (Only if key exists)
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'service-account-key.json');
  
  if (fs.existsSync(keyPath)) {
      try {
        console.log('[Database] Found GCP Credentials. Attempting BigQuery connection...');
        bqClient = new BigQuery({
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'volt-terminal-prod',
            keyFilename: keyPath
        });
        
        // Initialize Schema
        await initBigQuerySchema();
        
        dbType = 'BIGQUERY';
        isDBReady = true;
        console.log('[Database] Connected to Google BigQuery.');
        return;
      } catch (e) {
          console.warn('[Database] BigQuery connection failed:', e.message);
          console.warn('[Database] Falling back to local SQLite...');
      }
  } else {
      console.log('[Database] No GCP Credentials found. Using local SQLite.');
  }

  // 2. Fallback to SQLite (File or Memory)
  try {
      // Try file-based first
      try {
          sqliteDb = await open({
            filename: path.join(process.cwd(), 'volt_local.db'),
            driver: sqlite3.Database
          });
          console.log('[Database] Connected to SQLite (volt_local.db).');
      } catch (fileErr) {
          console.warn('[Database] Failed to open local file DB, using In-Memory DB.', fileErr.message);
          sqliteDb = await open({
              filename: ':memory:',
              driver: sqlite3.Database
          });
          console.log('[Database] Connected to In-Memory SQLite.');
      }

      // Configure timeouts
      if (sqliteDb) {
          await sqliteDb.run('PRAGMA busy_timeout = 3000;');
      }

      await initSqliteSchema();
      dbType = 'SQLITE';
      isDBReady = true;
  } catch (e) {
      console.error('[Database] CRITICAL: Could not initialize any database.', e);
      isDBReady = false;
  }
}

// --- Schema Initialization ---

async function initBigQuerySchema() {
    if (!bqClient) return;
    const [datasets] = await bqClient.getDatasets();
    if (!datasets.find(d => d.id === DATASET_ID)) {
      await bqClient.createDataset(DATASET_ID, { location: 'US' });
    }
    const dataset = bqClient.dataset(DATASET_ID);
    const [tables] = await dataset.getTables();
    
    // Feedback
    if (!tables.find(t => t.id === TABLE_FEEDBACK)) {
        await dataset.createTable(TABLE_FEEDBACK, {
          schema: [
            { name: 'name', type: 'STRING' },
            { name: 'email', type: 'STRING' },
            { name: 'message', type: 'STRING' },
            { name: 'timestamp', type: 'TIMESTAMP' }
          ]
        });
    }
    // Users (Identity)
    if (!tables.find(t => t.id === TABLE_USERS)) {
        await dataset.createTable(TABLE_USERS, {
          schema: [
            { name: 'username', type: 'STRING', mode: 'REQUIRED' },
            { name: 'email', type: 'STRING' },
            { name: 'created_at', type: 'TIMESTAMP' },
            { name: 'ip_address', type: 'STRING' }
          ]
        });
    }
    // Sessions (Activity)
    if (!tables.find(t => t.id === TABLE_SESSIONS)) {
        await dataset.createTable(TABLE_SESSIONS, {
          schema: [
            { name: 'username', type: 'STRING', mode: 'REQUIRED' },
            { name: 'session_id', type: 'STRING', mode: 'REQUIRED' },
            { name: 'action', type: 'STRING', mode: 'REQUIRED' }, // 'LOGIN' | 'HEARTBEAT'
            { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
            { name: 'ip_address', type: 'STRING' }
          ]
        });
    }
}

async function initSqliteSchema() {
    if (!sqliteDb) return;
    await sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            message TEXT,
            timestamp INTEGER
        );
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            email TEXT,
            created_at INTEGER,
            ip_address TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            username TEXT,
            login_time INTEGER,
            last_active INTEGER,
            ip_address TEXT
        );
    `);
}

// Global Check
export function isReady() {
    return isDBReady;
}

// --- Data Access Layer ---

export async function saveFeedback(name, email, message) {
    if (!isDBReady) return;

    if (dbType === 'BIGQUERY' && bqClient) {
        await bqClient.dataset(DATASET_ID).table(TABLE_FEEDBACK).insert([{
            name, email, message, timestamp: new Date().toISOString()
        }]);
    }
    else if (dbType === 'SQLITE' && sqliteDb) {
        await sqliteDb.run(
            'INSERT INTO feedback (name, email, message, timestamp) VALUES (?, ?, ?, ?)',
            name, email, message, Date.now()
        );
    }
}

// --- Auth & Tracking ---

export async function findUser(username) {
    if (!isDBReady) return null;

    if (dbType === 'BIGQUERY' && bqClient) {
        const query = `SELECT username, email FROM \`${DATASET_ID}.${TABLE_USERS}\` WHERE username = @username LIMIT 1`;
        const [rows] = await bqClient.query({ query, params: { username } });
        return rows[0] || null;
    } 
    else if (dbType === 'SQLITE' && sqliteDb) {
        return await sqliteDb.get('SELECT username, email FROM users WHERE username = ?', username);
    }
    return null;
}

export async function createUser(username, email, ip) {
    if (!isDBReady) return;

    if (dbType === 'BIGQUERY' && bqClient) {
        await bqClient.dataset(DATASET_ID).table(TABLE_USERS).insert([{
            username, email, created_at: new Date().toISOString(), ip_address: ip || 'unknown'
        }]);
    } 
    else if (dbType === 'SQLITE' && sqliteDb) {
        await sqliteDb.run(
            'INSERT INTO users (username, email, created_at, ip_address) VALUES (?, ?, ?, ?)',
            username, email, Date.now(), ip || 'unknown'
        );
    }
}

export async function logUserLogin(username, sessionId, ip) {
    if (!isDBReady) return;

    if (dbType === 'BIGQUERY' && bqClient) {
        await bqClient.dataset(DATASET_ID).table(TABLE_SESSIONS).insert([{
            username, session_id: sessionId, action: 'LOGIN', timestamp: new Date().toISOString(), ip_address: ip || 'unknown'
        }]);
    } 
    else if (dbType === 'SQLITE' && sqliteDb) {
        await sqliteDb.run(
            'INSERT INTO sessions (session_id, username, login_time, last_active, ip_address) VALUES (?, ?, ?, ?, ?)',
            sessionId, username, Date.now(), Date.now(), ip || 'unknown'
        );
    }
}

export async function updateUserHeartbeat(sessionId, username) {
    if (!isDBReady) return;

    if (dbType === 'BIGQUERY' && bqClient) {
        // BQ is append-only for efficiency, we aggregate later
        await bqClient.dataset(DATASET_ID).table(TABLE_SESSIONS).insert([{
            username, session_id: sessionId, action: 'HEARTBEAT', timestamp: new Date().toISOString(), ip_address: null
        }]);
    } 
    else if (dbType === 'SQLITE' && sqliteDb) {
        await sqliteDb.run(
            'UPDATE sessions SET last_active = ? WHERE session_id = ?',
            Date.now(), sessionId
        );
    }
}

export async function getAdminLogs() {
    if (!isDBReady) return [];

    if (dbType === 'BIGQUERY' && bqClient) {
        const query = `
            SELECT 
                username,
                session_id,
                MIN(timestamp) as login_time,
                MAX(timestamp) as last_active,
                TIMESTAMP_DIFF(MAX(timestamp), MIN(timestamp), MINUTE) as duration_minutes,
                ANY_VALUE(ip_address) as ip_address
            FROM \`${DATASET_ID}.${TABLE_SESSIONS}\`
            GROUP BY username, session_id
            ORDER BY last_active DESC
            LIMIT 100
        `;
        const [rows] = await bqClient.query(query);
        return rows.map(r => ({
            username: r.username,
            loginTime: r.login_time.value,
            lastActive: r.last_active.value,
            durationMinutes: r.duration_minutes,
            platform: 'BigQuery',
            ipAddress: r.ip_address
        }));
    } 
    else if (dbType === 'SQLITE' && sqliteDb) {
        const rows = await sqliteDb.all(`
            SELECT username, login_time, last_active, ip_address 
            FROM sessions 
            ORDER BY last_active DESC 
            LIMIT 100
        `);
        return rows.map(r => ({
            username: r.username,
            loginTime: new Date(r.login_time).toISOString(),
            lastActive: new Date(r.last_active).toISOString(),
            durationMinutes: Math.floor((r.last_active - r.login_time) / 60000),
            platform: 'SQLite',
            ipAddress: r.ip_address
        }));
    }
    return [];
}

export async function getRegisteredUsers() {
    if (!isDBReady) return [];

    if (dbType === 'BIGQUERY' && bqClient) {
        const query = `
            SELECT username, email, created_at, ip_address
            FROM \`${DATASET_ID}.${TABLE_USERS}\`
            ORDER BY created_at DESC
            LIMIT 100
        `;
        const [rows] = await bqClient.query(query);
        return rows.map(r => ({
            username: r.username,
            email: r.email,
            created_at: r.created_at.value,
            ipAddress: r.ip_address
        }));
    } 
    else if (dbType === 'SQLITE' && sqliteDb) {
        const rows = await sqliteDb.all(`
            SELECT username, email, created_at, ip_address 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        return rows.map(r => ({
            username: r.username,
            email: r.email,
            created_at: new Date(r.created_at).toISOString(),
            ipAddress: r.ip_address
        }));
    }
    return [];
}
