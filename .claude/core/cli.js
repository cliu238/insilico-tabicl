#!/usr/bin/env node

/**
 * CLI - Command-line interface for multi-agent orchestration system
 * Provides comprehensive control over swarm operations
 */

const HiveMind = require('./HiveMind');
const Logger = require('./Logger');
const fs = require('fs');
const path = require('path');

class CLI {
    constructor() {
        this.logger = new Logger('CLI', { level: 'info' });
        this.hiveMind = null;
        this.commands = {
            'init': this.initSwarm.bind(this),
            'spawn': this.spawnAgent.bind(this),
            'spawn-all': this.spawnAllAgents.bind(this),
            'orchestrate': this.orchestrateTask.bind(this),
            'status': this.showStatus.bind(this),
            'list-agents': this.listAgents.bind(this),
            'cleanup': this.cleanup.bind(this),
            'shutdown': this.shutdown.bind(this),
            'help': this.showHelp.bind(this)
        };
    }
    
    async run() {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            this.showHelp();
            return;
        }
        
        const command = args[0];
        const commandArgs = args.slice(1);
        
        if (!this.commands[command]) {
            this.logger.error(`Unknown command: ${command}`);
            this.showHelp();
            process.exit(1);
        }
        
        try {
            await this.commands[command](commandArgs);
        } catch (error) {
            this.logger.error(`Command failed: ${error.message}`);
            process.exit(1);
        }
    }
    
    async initSwarm(args) {
        const topology = args[0] || 'hierarchical';
        const maxAgents = parseInt(args[1]) || 8;
        const swarmName = args[2] || 'default';
        
        this.logger.info(`Initializing swarm: ${swarmName} (${topology}, max: ${maxAgents})`);
        
        this.hiveMind = new HiveMind({
            topology,
            maxAgents,
            name: swarmName
        });
        
        // Create database directories
        await this.ensureDirectories();
        
        this.logger.info('Swarm initialized successfully');
        
        // Save swarm configuration
        await this.saveSwarmConfig();
    }
    
    async spawnAgent(args) {
        if (!this.hiveMind) {
            await this.loadSwarmConfig();
        }
        
        const agentType = args[0];
        const agentName = args[1] || `${agentType}-${Date.now()}`;
        
        if (!agentType) {
            throw new Error('Agent type is required');
        }
        
        this.logger.info(`Spawning agent: ${agentName} (${agentType})`);
        
        const agent = await this.hiveMind.spawnAgent(agentType, agentName);
        
        this.logger.info(`Agent spawned successfully: ${agent.id}`);
    }
    
    async spawnAllAgents(args) {
        if (!this.hiveMind) {
            await this.loadSwarmConfig();
        }
        
        const agentTypes = [
            { type: 'data-processor', name: 'phmrc-processor' },
            { type: 'researcher', name: 'va-researcher' },
            { type: 'coordinator', name: 'task-coordinator' }
        ];
        
        this.logger.info('Spawning all standard agents...');
        
        for (const { type, name } of agentTypes) {
            try {
                await this.spawnAgent([type, name]);
            } catch (error) {
                this.logger.warn(`Failed to spawn ${name}: ${error.message}`);
            }
        }
        
        this.logger.info('Agent spawning complete');
    }
    
    async orchestrateTask(args) {
        if (!this.hiveMind) {
            await this.loadSwarmConfig();
        }
        
        const taskDescription = args[0];
        const strategy = args[1] || 'adaptive';
        const priority = args[2] || 'normal';
        const showResult = args.includes('--show-result');
        
        if (!taskDescription) {
            throw new Error('Task description is required');
        }
        
        this.logger.info(`Orchestrating task: "${taskDescription}" (${strategy}, ${priority})`);
        
        const result = await this.hiveMind.orchestrateTask({
            description: taskDescription
        }, strategy, priority);
        
        this.logger.info('Task orchestration completed');
        
        if (showResult) {
            console.log('\n--- Task Result ---');
            console.log(JSON.stringify(result, null, 2));
        }
        
        return result;
    }
    
    async showStatus(args) {
        if (!this.hiveMind) {
            await this.loadSwarmConfig();
        }
        
        const detailed = args.includes('--detailed');
        const status = await this.hiveMind.getStatus();
        
        console.log('\n--- Swarm Status ---');
        console.log(`HiveMind ID: ${status.hiveMindId}`);
        console.log(`Status: ${status.status}`);
        console.log(`Topology: ${status.topology}`);
        console.log(`Active Agents: ${status.activeAgents}/${status.maxAgents}`);
        
        console.log('\n--- Metrics ---');
        console.log(`Tasks Completed: ${status.metrics.tasksCompleted}`);
        console.log(`Total Execution Time: ${status.metrics.totalExecutionTime}ms`);
        console.log(`Agents Spawned: ${status.metrics.agentsSpawned}`);
        console.log(`Messages Processed: ${status.metrics.messagesProcessed}`);
        
        if (detailed && status.agents) {
            console.log('\n--- Agent Details ---');
            for (const [id, agent] of Object.entries(status.agents)) {
                console.log(`${agent.name} (${agent.type}): ${agent.status} - ${agent.tasksCompleted} tasks`);
            }
        }
        
        if (status.memoryStats) {
            console.log('\n--- Memory Stats ---');
            console.log(`Cache Size: ${status.memoryStats.cacheSize}`);
            console.log(`DB Size: ${status.memoryStats.dbSize}`);
            console.log(`Hit Rate: ${(status.memoryStats.hitRate * 100).toFixed(2)}%`);
        }
    }
    
    async listAgents(args) {
        if (!this.hiveMind) {
            await this.loadSwarmConfig();
        }
        
        const status = await this.hiveMind.getStatus();
        
        console.log('\n--- Active Agents ---');
        if (status.agents && Object.keys(status.agents).length > 0) {
            for (const [id, agent] of Object.entries(status.agents)) {
                console.log(`${agent.name}`);
                console.log(`  ID: ${id}`);
                console.log(`  Type: ${agent.type}`);
                console.log(`  Status: ${agent.status}`);
                console.log(`  Tasks Completed: ${agent.tasksCompleted}`);
                console.log('');
            }
        } else {
            console.log('No active agents');
        }
    }
    
    async cleanup(args) {
        if (!this.hiveMind) {
            await this.loadSwarmConfig();
        }
        
        this.logger.info('Starting cleanup...');
        
        // Cleanup memory and message bus
        if (this.hiveMind.memory) {
            await this.hiveMind.memory.cleanup();
        }
        
        if (this.hiveMind.messageBus) {
            await this.hiveMind.messageBus.cleanup();
        }
        
        this.logger.info('Cleanup completed');
    }
    
    async shutdown(args) {
        if (!this.hiveMind) {
            this.logger.info('No active swarm to shutdown');
            return;
        }
        
        this.logger.info('Shutting down swarm...');
        
        await this.hiveMind.shutdown();
        this.hiveMind = null;
        
        // Remove swarm configuration
        const configPath = path.join('.claude', 'swarm-config.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        
        this.logger.info('Swarm shutdown completed');
    }
    
    showHelp() {
        console.log(`
Claude Flow Multi-Agent Orchestration System CLI

Usage: node .claude/core/cli.js <command> [options]

Commands:
  init <topology> <maxAgents> [name]    Initialize swarm
    topology: hierarchical, mesh, ring, star (default: hierarchical)
    maxAgents: maximum number of agents (default: 8)
    name: swarm name (default: default)

  spawn <type> [name]                   Spawn a single agent
    type: data-processor, researcher, coordinator
    name: custom agent name (optional)

  spawn-all                             Spawn all standard agents

  orchestrate <task> [strategy] [priority] [--show-result]
    task: task description (required)
    strategy: adaptive, parallel, sequential, hierarchical (default: adaptive)
    priority: normal, high (default: normal)
    --show-result: display full result output

  status [--detailed]                   Show swarm status
    --detailed: include agent-level details

  list-agents                           List all active agents

  cleanup                               Clean up expired data and messages

  shutdown                              Shutdown swarm and cleanup

  help                                  Show this help

Examples:
  node .claude/core/cli.js init hierarchical 8 phmrc-analysis
  node .claude/core/cli.js spawn-all
  node .claude/core/cli.js orchestrate "PHMRC child data exploration" parallel high --show-result
  node .claude/core/cli.js status --detailed
        `);
    }
    
    async ensureDirectories() {
        const dirs = [
            '.claude/db',
            '.claude/logs',
            'data_exploration',
            'data_exploration/results'
        ];
        
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
    
    async saveSwarmConfig() {
        const config = {
            topology: this.hiveMind.topology,
            maxAgents: this.hiveMind.maxAgents,
            id: this.hiveMind.id,
            timestamp: Date.now()
        };
        
        const configPath = path.join('.claude', 'swarm-config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    
    async loadSwarmConfig() {
        const configPath = path.join('.claude', 'swarm-config.json');
        
        if (!fs.existsSync(configPath)) {
            throw new Error('No swarm configuration found. Please run "init" first.');
        }
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        this.hiveMind = new HiveMind({
            topology: config.topology,
            maxAgents: config.maxAgents,
            id: config.id
        });
        
        this.logger.info(`Loaded swarm configuration: ${config.topology} topology`);
    }
}

// Run CLI if called directly
if (require.main === module) {
    const cli = new CLI();
    cli.run().catch(error => {
        console.error('CLI Error:', error.message);
        process.exit(1);
    });
}

module.exports = CLI;