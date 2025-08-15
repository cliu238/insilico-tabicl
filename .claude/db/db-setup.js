#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

/**
 * Database setup script for the multi-agent swarm system
 * 
 * Creates and initializes the SQLite database with the complete schema
 */
class DatabaseSetup {
  constructor() {
    this.dbPath = path.join(__dirname, 'swarm.db');
    this.memoryDbPath = path.join(__dirname, 'memory.db');
    this.schemaPath = path.join(__dirname, 'schema.sql');
    this.db = null;
  }

  /**
   * Initialize the database setup
   */
  async initialize() {
    try {
      console.log('🗄️  Setting up multi-agent swarm database...');
      
      // Create main swarm database
      await this.createSwarmDatabase();
      
      // Create memory database
      await this.createMemoryDatabase();
      
      console.log('✅ Database setup completed successfully');
      console.log(`📍 Main database: ${this.dbPath}`);
      console.log(`📍 Memory database: ${this.memoryDbPath}`);
      
    } catch (error) {
      console.error('❌ Database setup failed:', error.message);
      throw error;
    }
  }

  /**
   * Create the main swarm database
   */
  async createSwarmDatabase() {
    return new Promise((resolve, reject) => {
      console.log('Creating main swarm database...');
      
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to create database: ${err.message}`));
          return;
        }
        
        console.log('Database file created, applying schema...');
        this.applySchema().then(resolve).catch(reject);
      });
    });
  }

  /**
   * Apply the database schema
   */
  async applySchema() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.schemaPath)) {
        reject(new Error(`Schema file not found: ${this.schemaPath}`));
        return;
      }
      
      const schema = fs.readFileSync(this.schemaPath, 'utf8');
      
      this.db.exec(schema, (err) => {
        if (err) {
          reject(new Error(`Failed to apply schema: ${err.message}`));
          return;
        }
        
        console.log('Schema applied successfully');
        this.db.close((closeErr) => {
          if (closeErr) {
            reject(new Error(`Failed to close database: ${closeErr.message}`));
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Create the memory database
   */
  async createMemoryDatabase() {
    return new Promise((resolve, reject) => {
      console.log('Creating memory database...');
      
      const memoryDb = new sqlite3.Database(this.memoryDbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to create memory database: ${err.message}`));
          return;
        }
        
        // Create memory-specific tables
        const memorySchema = `
          CREATE TABLE IF NOT EXISTS memory_entries (
            id TEXT PRIMARY KEY,
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            metadata TEXT,
            ttl INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            UNIQUE(namespace, key)
          );
          
          CREATE INDEX IF NOT EXISTS idx_namespace ON memory_entries(namespace);
          CREATE INDEX IF NOT EXISTS idx_key ON memory_entries(key);
          CREATE INDEX IF NOT EXISTS idx_expires_at ON memory_entries(expires_at);
          
          CREATE TABLE IF NOT EXISTS namespaces (
            name TEXT PRIMARY KEY,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
        memoryDb.exec(memorySchema, (schemaErr) => {
          if (schemaErr) {
            reject(new Error(`Failed to apply memory schema: ${schemaErr.message}`));
            return;
          }
          
          console.log('Memory database schema applied');
          memoryDb.close((closeErr) => {
            if (closeErr) {
              reject(new Error(`Failed to close memory database: ${closeErr.message}`));
            } else {
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Verify database integrity
   */
  async verifyDatabase() {
    return new Promise((resolve, reject) => {
      console.log('Verifying database integrity...');
      
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(new Error(`Failed to open database for verification: ${err.message}`));
          return;
        }
        
        // Check if main tables exist
        const tableChecks = [
          'swarms',
          'agents', 
          'tasks',
          'collective_memory',
          'agent_communications',
          'task_contexts',
          'agent_metrics',
          'swarm_events',
          'checkpoints'
        ];
        
        let checkedTables = 0;
        
        tableChecks.forEach(tableName => {
          db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tableName],
            (err, row) => {
              if (err) {
                reject(new Error(`Error checking table ${tableName}: ${err.message}`));
                return;
              }
              
              if (!row) {
                reject(new Error(`Table ${tableName} not found`));
                return;
              }
              
              checkedTables++;
              
              if (checkedTables === tableChecks.length) {
                console.log('✅ All tables verified successfully');
                db.close();
                resolve();
              }
            }
          );
        });
      });
    });
  }

  /**
   * Reset database (drop and recreate)
   */
  async resetDatabase() {
    try {
      console.log('🔄 Resetting database...');
      
      // Remove existing database files
      if (fs.existsSync(this.dbPath)) {
        fs.unlinkSync(this.dbPath);
        console.log('Removed existing main database');
      }
      
      if (fs.existsSync(this.memoryDbPath)) {
        fs.unlinkSync(this.memoryDbPath);
        console.log('Removed existing memory database');
      }
      
      // Recreate databases
      await this.initialize();
      
      console.log('✅ Database reset completed');
      
    } catch (error) {
      console.error('❌ Database reset failed:', error.message);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        const stats = {};
        let queriesCompleted = 0;
        const totalQueries = 9;
        
        const checkComplete = () => {
          queriesCompleted++;
          if (queriesCompleted === totalQueries) {
            db.close();
            resolve(stats);
          }
        };
        
        // Get table counts
        const tables = ['swarms', 'agents', 'tasks', 'collective_memory', 
                       'agent_communications', 'task_contexts', 'agent_metrics', 
                       'swarm_events', 'checkpoints'];
        
        tables.forEach(table => {
          db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
            if (err) {
              stats[table] = 'error';
            } else {
              stats[table] = row.count;
            }
            checkComplete();
          });
        });
      });
    });
  }
}

// Command line interface
async function main() {
  const setup = new DatabaseSetup();
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'init':
        await setup.initialize();
        await setup.verifyDatabase();
        break;
        
      case 'reset':
        await setup.resetDatabase();
        break;
        
      case 'verify':
        await setup.verifyDatabase();
        break;
        
      case 'stats':
        const stats = await setup.getDatabaseStats();
        console.log('📊 Database Statistics:');
        console.table(stats);
        break;
        
      default:
        console.log('Usage: node db-setup.js [init|reset|verify|stats]');
        console.log('  init   - Initialize database with schema');
        console.log('  reset  - Drop and recreate database');
        console.log('  verify - Verify database integrity');
        console.log('  stats  - Show database statistics');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('Database operation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = DatabaseSetup;