/**
 * HiveMind - Central orchestration engine for multi-agent coordination
 * Supports multiple topologies and dynamic agent lifecycle management
 */

const { v4: uuidv4 } = require('uuid');
const Database = require('sqlite3').Database;
const Logger = require('./Logger');
const DistributedMemory = require('../memory/DistributedMemory');
const MessageBus = require('../communication/MessageBus');
const Agent = require('./Agent');

class HiveMind {
    constructor(config = {}) {
        this.id = config.id || uuidv4();
        this.topology = config.topology || 'hierarchical';
        this.maxAgents = config.maxAgents || 8;
        this.config = config;
        
        this.logger = new Logger('HiveMind', { level: 'info' });
        this.agents = new Map();
        this.status = 'initialized';
        this.metrics = {
            tasksCompleted: 0,
            totalExecutionTime: 0,
            agentsSpawned: 0,
            messagesProcessed: 0
        };
        
        // Initialize core systems
        this.memory = new DistributedMemory(config.memory || {});
        this.messageBus = new MessageBus(config.messageBus || {});
        
        // Database connection
        this.db = null;
        this.initializeDatabase();
        
        this.logger.info(`HiveMind initialized with topology: ${this.topology}`);
    }
    
    async initializeDatabase() {
        try {
            this.db = new Database('.claude/db/hivemind.db');
            this.logger.info('Database connection established');
        } catch (error) {
            this.logger.error('Failed to initialize database:', error);
        }
    }
    
    async spawnAgent(agentType, agentName, config = {}) {
        if (this.agents.size >= this.maxAgents) {
            throw new Error(`Maximum agents (${this.maxAgents}) reached`);
        }
        
        const agentId = uuidv4();
        const agent = new Agent({
            id: agentId,
            name: agentName,
            type: agentType,
            hiveMind: this,
            memory: this.memory,
            messageBus: this.messageBus,
            ...config
        });
        
        await agent.initialize();
        this.agents.set(agentId, agent);
        this.metrics.agentsSpawned++;
        
        this.logger.info(`Agent spawned: ${agentName} (${agentType}) [${agentId}]`);
        return agent;
    }
    
    async orchestrateTask(task, strategy = 'adaptive', priority = 'normal') {
        const startTime = Date.now();
        this.logger.info(`Orchestrating task: ${task.description || task}`);
        
        try {
            // Create task context in distributed memory
            const taskContext = {
                id: uuidv4(),
                description: task.description || task,
                strategy,
                priority,
                status: 'started',
                startTime,
                agents: [],
                results: {}
            };
            
            await this.memory.store(`task:${taskContext.id}`, taskContext, 3600); // 1 hour TTL
            
            // Execute based on strategy
            let result;
            switch (strategy) {
                case 'hierarchical':
                    result = await this.executeHierarchical(taskContext);
                    break;
                case 'parallel':
                    result = await this.executeParallel(taskContext);
                    break;
                case 'sequential':
                    result = await this.executeSequential(taskContext);
                    break;
                case 'adaptive':
                default:
                    result = await this.executeAdaptive(taskContext);
                    break;
            }
            
            const executionTime = Date.now() - startTime;
            this.metrics.tasksCompleted++;
            this.metrics.totalExecutionTime += executionTime;
            
            // Store final result
            taskContext.status = 'completed';
            taskContext.endTime = Date.now();
            taskContext.executionTime = executionTime;
            taskContext.result = result;
            
            await this.memory.store(`task:${taskContext.id}:final`, taskContext, 86400); // 24 hours TTL
            
            this.logger.info(`Task completed in ${executionTime}ms`);
            return result;
            
        } catch (error) {
            this.logger.error('Task orchestration failed:', error);
            throw error;
        }
    }
    
    async executeAdaptive(taskContext) {
        // Adaptive strategy: choose best approach based on task characteristics
        const availableAgents = Array.from(this.agents.values()).filter(a => a.status === 'idle' || a.status === 'ready');
        
        if (availableAgents.length === 0) {
            throw new Error('No available agents for task execution');
        }
        
        // Simple adaptive logic - use parallel for multiple agents, sequential for single agent
        if (availableAgents.length > 1) {
            return this.executeParallel(taskContext);
        } else {
            return this.executeSequential(taskContext);
        }
    }
    
    async executeParallel(taskContext) {
        const availableAgents = Array.from(this.agents.values()).filter(a => a.status === 'idle' || a.status === 'ready');
        const promises = [];
        
        // Assign task to all available agents
        for (const agent of availableAgents) {
            taskContext.agents.push(agent.id);
            promises.push(agent.executeTask(taskContext));
        }
        
        const results = await Promise.allSettled(promises);
        const successfulResults = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
        
        // Aggregate results
        return {
            type: 'parallel',
            agentsUsed: availableAgents.length,
            results: successfulResults,
            aggregatedResult: this.aggregateResults(successfulResults)
        };
    }
    
    async executeSequential(taskContext) {
        const availableAgents = Array.from(this.agents.values()).filter(a => a.status === 'idle' || a.status === 'ready');
        
        if (availableAgents.length === 0) {
            throw new Error('No available agents');
        }
        
        const results = [];
        for (const agent of availableAgents) {
            taskContext.agents.push(agent.id);
            const result = await agent.executeTask(taskContext);
            results.push(result);
            
            // Store intermediate result for next agent to use
            await this.memory.store(`task:${taskContext.id}:step:${results.length}`, result, 3600);
        }
        
        return {
            type: 'sequential',
            agentsUsed: availableAgents.length,
            results: results
        };
    }
    
    async executeHierarchical(taskContext) {
        // Find queen agent or designate one
        const queenAgent = Array.from(this.agents.values()).find(a => a.type === 'coordinator') ||
                          Array.from(this.agents.values())[0];
        
        if (!queenAgent) {
            throw new Error('No agents available for hierarchical execution');
        }
        
        taskContext.queen = queenAgent.id;
        const result = await queenAgent.executeTask(taskContext);
        
        return {
            type: 'hierarchical',
            queen: queenAgent.id,
            result: result
        };
    }
    
    aggregateResults(results) {
        // Simple aggregation - can be enhanced based on result types
        if (results.length === 0) return null;
        if (results.length === 1) return results[0];
        
        return {
            summary: `Aggregated ${results.length} results`,
            individualResults: results,
            consensus: this.findConsensus(results)
        };
    }
    
    findConsensus(results) {
        // Simple consensus mechanism
        const resultStrings = results.map(r => JSON.stringify(r));
        const counts = {};
        
        resultStrings.forEach(r => {
            counts[r] = (counts[r] || 0) + 1;
        });
        
        const mostCommon = Object.keys(counts).reduce((a, b) => 
            counts[a] > counts[b] ? a : b
        );
        
        return JSON.parse(mostCommon);
    }
    
    async getStatus() {
        const agentStatuses = {};
        for (const [id, agent] of this.agents) {
            agentStatuses[id] = {
                name: agent.name,
                type: agent.type,
                status: agent.status,
                tasksCompleted: agent.metrics.tasksCompleted
            };
        }
        
        return {
            hiveMindId: this.id,
            status: this.status,
            topology: this.topology,
            activeAgents: this.agents.size,
            maxAgents: this.maxAgents,
            metrics: this.metrics,
            agents: agentStatuses,
            memoryStats: await this.memory.getStats()
        };
    }
    
    async shutdown() {
        this.logger.info('Shutting down HiveMind...');
        
        // Shutdown all agents
        const shutdownPromises = Array.from(this.agents.values()).map(agent => 
            agent.shutdown().catch(err => this.logger.error(`Failed to shutdown agent ${agent.name}:`, err))
        );
        
        await Promise.allSettled(shutdownPromises);
        
        // Close database connection
        if (this.db) {
            this.db.close();
        }
        
        this.status = 'shutdown';
        this.logger.info('HiveMind shutdown complete');
    }
}

module.exports = HiveMind;