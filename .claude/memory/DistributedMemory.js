/**
 * DistributedMemory - High-performance distributed memory system for agent collaboration
 * Features namespace isolation, TTL support, and performance optimization
 */

const { v4: uuidv4 } = require('uuid');
const Database = require('sqlite3').Database;
const Logger = require('../core/Logger');

class DistributedMemory {
    constructor(config = {}) {
        this.config = config;
        this.cache = new Map(); // Local in-memory cache
        this.logger = new Logger('DistributedMemory', { level: 'info' });
        
        this.metrics = {
            reads: 0,
            writes: 0,
            hits: 0,
            misses: 0,
            cleanupRuns: 0,
            itemsCleanedUp: 0
        };
        
        this.db = null;
        this.initializeDatabase();
        
        // Start cleanup routine
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
        
        this.logger.info('DistributedMemory initialized');
    }
    
    async initializeDatabase() {
        try {
            this.db = new Database('.claude/db/memory.db');
            
            // Create memory table if it doesn't exist
            this.db.run(`
                CREATE TABLE IF NOT EXISTS memory_store (
                    key TEXT PRIMARY KEY,
                    namespace TEXT,
                    value TEXT,
                    created_at INTEGER,
                    expires_at INTEGER,
                    access_count INTEGER DEFAULT 0,
                    last_accessed INTEGER
                )
            `);
            
            this.db.run(`
                CREATE INDEX IF NOT EXISTS idx_namespace ON memory_store(namespace);
            `);
            
            this.db.run(`
                CREATE INDEX IF NOT EXISTS idx_expires_at ON memory_store(expires_at);
            `);
            
            this.logger.info('Memory database initialized');
        } catch (error) {
            this.logger.error('Failed to initialize memory database:', error);
        }
    }
    
    async store(key, value, ttlSeconds = 3600, namespace = 'default') {
        this.metrics.writes++;
        
        const now = Date.now();
        const expiresAt = ttlSeconds > 0 ? now + (ttlSeconds * 1000) : null;
        const fullKey = `${namespace}:${key}`;
        
        const item = {
            key: fullKey,
            namespace,
            value: JSON.stringify(value),
            createdAt: now,
            expiresAt,
            accessCount: 0,
            lastAccessed: now
        };
        
        // Store in local cache
        this.cache.set(fullKey, item);
        
        // Store in database
        if (this.db) {
            try {
                await new Promise((resolve, reject) => {
                    this.db.run(
                        `INSERT OR REPLACE INTO memory_store 
                         (key, namespace, value, created_at, expires_at, access_count, last_accessed)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [fullKey, namespace, item.value, item.createdAt, item.expiresAt, 0, item.lastAccessed],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            } catch (error) {
                this.logger.error('Failed to store in database:', error);
            }
        }
        
        this.logger.debug(`Stored key: ${fullKey}`);
        return true;
    }
    
    async retrieve(key, namespace = 'default') {
        this.metrics.reads++;
        
        const fullKey = `${namespace}:${key}`;
        const now = Date.now();
        
        // Check local cache first
        let item = this.cache.get(fullKey);
        
        if (item) {
            // Check if expired
            if (item.expiresAt && now > item.expiresAt) {
                this.cache.delete(fullKey);
                this.metrics.misses++;
                return null;
            }
            
            // Update access stats
            item.accessCount++;
            item.lastAccessed = now;
            this.metrics.hits++;
            
            return JSON.parse(item.value);
        }
        
        // Try database
        if (this.db) {
            try {
                const dbItem = await new Promise((resolve, reject) => {
                    this.db.get(
                        `SELECT * FROM memory_store WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)`,
                        [fullKey, now],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });
                
                if (dbItem) {
                    // Update access stats in DB
                    this.db.run(
                        `UPDATE memory_store SET access_count = access_count + 1, last_accessed = ? WHERE key = ?`,
                        [now, fullKey]
                    );
                    
                    // Cache the item
                    const cachedItem = {
                        key: fullKey,
                        namespace: dbItem.namespace,
                        value: dbItem.value,
                        createdAt: dbItem.created_at,
                        expiresAt: dbItem.expires_at,
                        accessCount: dbItem.access_count + 1,
                        lastAccessed: now
                    };
                    
                    this.cache.set(fullKey, cachedItem);
                    this.metrics.hits++;
                    
                    return JSON.parse(dbItem.value);
                }
            } catch (error) {
                this.logger.error('Failed to retrieve from database:', error);
            }
        }
        
        this.metrics.misses++;
        return null;
    }
    
    async delete(key, namespace = 'default') {
        const fullKey = `${namespace}:${key}`;
        
        // Remove from cache
        this.cache.delete(fullKey);
        
        // Remove from database
        if (this.db) {
            try {
                await new Promise((resolve, reject) => {
                    this.db.run(
                        `DELETE FROM memory_store WHERE key = ?`,
                        [fullKey],
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            } catch (error) {
                this.logger.error('Failed to delete from database:', error);
                return false;
            }
        }
        
        this.logger.debug(`Deleted key: ${fullKey}`);
        return true;
    }
    
    async search(pattern, namespace = 'default') {
        const results = [];
        const namespacePrefix = `${namespace}:`;
        
        // Search in cache
        for (const [key, item] of this.cache) {
            if (key.startsWith(namespacePrefix)) {
                const shortKey = key.substring(namespacePrefix.length);
                if (new RegExp(pattern).test(shortKey)) {
                    results.push({
                        key: shortKey,
                        value: JSON.parse(item.value),
                        metadata: {
                            createdAt: item.createdAt,
                            expiresAt: item.expiresAt,
                            accessCount: item.accessCount,
                            lastAccessed: item.lastAccessed
                        }
                    });
                }
            }
        }
        
        // Search in database for items not in cache
        if (this.db) {
            try {
                const dbResults = await new Promise((resolve, reject) => {
                    this.db.all(
                        `SELECT * FROM memory_store 
                         WHERE namespace = ? AND key GLOB ? 
                         AND (expires_at IS NULL OR expires_at > ?)`,
                        [namespace, `${namespace}:*${pattern}*`, Date.now()],
                        (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        }
                    );
                });
                
                for (const row of dbResults) {
                    const shortKey = row.key.substring(namespacePrefix.length);
                    // Avoid duplicates from cache
                    if (!this.cache.has(row.key)) {
                        results.push({
                            key: shortKey,
                            value: JSON.parse(row.value),
                            metadata: {
                                createdAt: row.created_at,
                                expiresAt: row.expires_at,
                                accessCount: row.access_count,
                                lastAccessed: row.last_accessed
                            }
                        });
                    }
                }
            } catch (error) {
                this.logger.error('Failed to search database:', error);
            }
        }
        
        return results;
    }
    
    async getNamespaceKeys(namespace = 'default') {
        const keys = [];
        const namespacePrefix = `${namespace}:`;
        
        // Get from cache
        for (const key of this.cache.keys()) {
            if (key.startsWith(namespacePrefix)) {
                keys.push(key.substring(namespacePrefix.length));
            }
        }
        
        // Get from database
        if (this.db) {
            try {
                const dbKeys = await new Promise((resolve, reject) => {
                    this.db.all(
                        `SELECT key FROM memory_store 
                         WHERE namespace = ? AND (expires_at IS NULL OR expires_at > ?)`,
                        [namespace, Date.now()],
                        (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows.map(row => row.key.substring(namespacePrefix.length)));
                        }
                    );
                });
                
                // Merge and deduplicate
                const allKeys = new Set([...keys, ...dbKeys]);
                return Array.from(allKeys);
            } catch (error) {
                this.logger.error('Failed to get namespace keys:', error);
            }
        }
        
        return keys;
    }
    
    async cleanup() {
        this.metrics.cleanupRuns++;
        const now = Date.now();
        let cleanedUp = 0;
        
        // Cleanup cache
        for (const [key, item] of this.cache) {
            if (item.expiresAt && now > item.expiresAt) {
                this.cache.delete(key);
                cleanedUp++;
            }
        }
        
        // Cleanup database
        if (this.db) {
            try {
                const result = await new Promise((resolve, reject) => {
                    this.db.run(
                        `DELETE FROM memory_store WHERE expires_at IS NOT NULL AND expires_at < ?`,
                        [now],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.changes);
                        }
                    );
                });
                
                cleanedUp += result;
            } catch (error) {
                this.logger.error('Failed to cleanup database:', error);
            }
        }
        
        this.metrics.itemsCleanedUp += cleanedUp;
        
        if (cleanedUp > 0) {
            this.logger.debug(`Cleaned up ${cleanedUp} expired items`);
        }
    }
    
    async getStats() {
        const cacheSize = this.cache.size;
        let dbSize = 0;
        
        if (this.db) {
            try {
                dbSize = await new Promise((resolve, reject) => {
                    this.db.get(
                        `SELECT COUNT(*) as count FROM memory_store WHERE expires_at IS NULL OR expires_at > ?`,
                        [Date.now()],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row.count);
                        }
                    );
                });
            } catch (error) {
                this.logger.error('Failed to get database stats:', error);
            }
        }
        
        return {
            ...this.metrics,
            cacheSize,
            dbSize,
            hitRate: this.metrics.reads > 0 ? this.metrics.hits / this.metrics.reads : 0
        };
    }
    
    async shutdown() {
        // Clear cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        // Final cleanup
        await this.cleanup();
        
        // Close database
        if (this.db) {
            this.db.close();
        }
        
        this.logger.info('DistributedMemory shutdown complete');
    }
}

module.exports = DistributedMemory;