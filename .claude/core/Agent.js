/**
 * Agent - Base class for all swarm agents with task execution capabilities
 * Features markdown-based agent definition loading and memory management
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const Logger = require('./Logger');

class Agent {
    constructor(config) {
        this.id = config.id || uuidv4();
        this.name = config.name || 'UnnamedAgent';
        this.type = config.type || 'general';
        this.hiveMind = config.hiveMind;
        this.memory = config.memory;
        this.messageBus = config.messageBus;
        this.config = config;
        
        this.logger = new Logger(`Agent:${this.name}`, { level: 'info' });
        this.status = 'idle';
        this.currentTask = null;
        
        this.metrics = {
            tasksCompleted: 0,
            tasksStarted: 0,
            tasksFailed: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            messagesProcessed: 0
        };
        
        // Agent capabilities loaded from markdown definition
        this.capabilities = [];
        this.systemPrompt = '';
        this.tools = [];
        this.namespace = `agent:${this.name}`;
        
        this.logger.info(`Agent ${this.name} (${this.type}) initialized [${this.id}]`);
    }
    
    async initialize() {
        try {
            // Register with message bus
            if (this.messageBus) {
                this.messageBus.registerAgent(this.id, this.name);
            }
            
            // Load agent definition from markdown file
            await this.loadAgentDefinition();
            
            // Initialize agent namespace in memory
            if (this.memory) {
                await this.memory.store('initialized', true, 3600, this.namespace);
                // Store a safe version of config without circular references
                const safeConfig = {
                    id: this.id,
                    name: this.name,
                    type: this.type,
                    timestamp: Date.now()
                };
                await this.memory.store('config', safeConfig, 3600, this.namespace);
            }
            
            this.status = 'ready';
            this.logger.info(`Agent ${this.name} initialization complete`);
            
        } catch (error) {
            this.logger.error('Agent initialization failed:', error);
            this.status = 'error';
            throw error;
        }
    }
    
    async loadAgentDefinition() {
        const definitionPath = path.join('.claude', 'agents', 'specialists', `${this.type}.md`);
        
        if (fs.existsSync(definitionPath)) {
            try {
                const content = fs.readFileSync(definitionPath, 'utf8');
                this.parseAgentDefinition(content);
                this.logger.debug(`Loaded agent definition from ${definitionPath}`);
            } catch (error) {
                this.logger.warn(`Failed to load agent definition: ${error.message}`);
                // Use default generic capabilities
                this.loadDefaultCapabilities();
            }
        } else {
            this.logger.debug(`No agent definition found for type ${this.type}, using defaults`);
            this.loadDefaultCapabilities();
        }
    }
    
    parseAgentDefinition(content) {
        // Simple markdown parser to extract YAML front matter and content
        const lines = content.split('\n');
        let inFrontMatter = false;
        let frontMatterContent = '';
        let bodyContent = '';
        
        for (const line of lines) {
            if (line.trim() === '---') {
                if (!inFrontMatter) {
                    inFrontMatter = true;
                } else {
                    inFrontMatter = false;
                }
                continue;
            }
            
            if (inFrontMatter) {
                frontMatterContent += line + '\n';
            } else {
                bodyContent += line + '\n';
            }
        }
        
        // Parse front matter (simplified YAML parsing)
        if (frontMatterContent) {
            this.parseYamlFrontMatter(frontMatterContent);
        }
        
        this.systemPrompt = bodyContent.trim();
    }
    
    parseYamlFrontMatter(content) {
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('capabilities:')) {
                // Simple list parsing
                continue;
            } else if (trimmed.startsWith('- ')) {
                this.capabilities.push(trimmed.substring(2).trim());
            } else if (trimmed.includes(':')) {
                const [key, value] = trimmed.split(':').map(s => s.trim());
                if (key === 'name') this.name = value.replace(/['"]/g, '');
                if (key === 'type') this.type = value.replace(/['"]/g, '');
            }
        }
    }
    
    loadDefaultCapabilities() {
        this.capabilities = [
            'general_task_processing',
            'data_analysis',
            'file_operations',
            'basic_computation'
        ];
        
        this.systemPrompt = `You are a general-purpose agent named ${this.name}. 
You can process various tasks and collaborate with other agents through shared memory.
Always provide detailed, accurate responses and store important results in shared memory.`;
    }
    
    async executeTask(taskContext) {
        if (this.status !== 'ready' && this.status !== 'idle') {
            throw new Error(`Agent ${this.name} is not available (status: ${this.status})`);
        }
        
        this.status = 'working';
        this.currentTask = taskContext;
        this.metrics.tasksStarted++;
        
        const startTime = Date.now();
        
        try {
            this.logger.info(`Executing task: ${taskContext.description}`);
            
            // Store task start in memory
            await this.memory.store(`task:${taskContext.id}:start`, {
                agent: this.name,
                agentId: this.id,
                startTime,
                status: 'started'
            }, 3600, this.namespace);
            
            // Execute the actual task based on agent type and capabilities
            const result = await this.processTask(taskContext);
            
            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime, 'completed');
            
            // Store result in memory
            await this.memory.store(`task:${taskContext.id}:result:${this.id}`, {
                agent: this.name,
                agentId: this.id,
                result,
                executionTime,
                status: 'completed'
            }, 3600, this.namespace);
            
            this.status = 'idle';
            this.currentTask = null;
            
            this.logger.info(`Task completed in ${executionTime}ms`);
            return result;
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime, 'failed');
            
            await this.memory.store(`task:${taskContext.id}:error:${this.id}`, {
                agent: this.name,
                agentId: this.id,
                error: error.message,
                executionTime,
                status: 'failed'
            }, 3600, this.namespace);
            
            this.status = 'idle';
            this.currentTask = null;
            this.logger.error(`Task failed after ${executionTime}ms:`, error);
            throw error;
        }
    }
    
    async processTask(taskContext) {
        // This is the core task processing logic
        // In a real implementation, this would interface with Claude or other AI models
        
        // For now, simulate task processing based on agent type
        switch (this.type) {
            case 'data-processor':
                return this.processDataTask(taskContext);
            case 'researcher':
                return this.processResearchTask(taskContext);
            case 'coordinator':
                return this.processCoordinationTask(taskContext);
            default:
                return this.processGenericTask(taskContext);
        }
    }
    
    async processDataTask(taskContext) {
        // Simulate data processing task
        this.logger.info('Processing data analysis task...');
        
        // Check if we're working on PHMRC data exploration
        if (taskContext.description.toLowerCase().includes('phmrc')) {
            return this.processPHMRCExploration(taskContext);
        }
        
        return {
            type: 'data_analysis',
            agent: this.name,
            summary: 'Data processing completed',
            details: `Processed task: ${taskContext.description}`,
            timestamp: Date.now()
        };
    }
    
    async processPHMRCExploration(taskContext) {
        this.logger.info('Starting PHMRC child dataset exploration...');
        
        try {
            // Execute Python script for PHMRC exploration
            const pythonScript = `
import pandas as pd
import numpy as np
import json
from pathlib import Path
import sys

def explore_phmrc_child():
    # Load PHMRC child dataset
    data_path = Path("data/raw/PHMRC/IHME_PHMRC_VA_DATA_CHILD_Y2013M09D11_0.csv")
    
    if not data_path.exists():
        return {"error": f"Dataset not found at {data_path}"}
    
    df = pd.read_csv(data_path, low_memory=False)
    
    # Basic dataset info
    basic_info = {
        "n_rows": len(df),
        "n_cols": len(df.columns),
        "columns": list(df.columns)
    }
    
    # Validate gs_text34 column
    if 'gs_text34' not in df.columns:
        return {"error": "gs_text34 column not found"}
    
    cause_distribution = df['gs_text34'].value_counts().to_dict()
    
    # Categorize columns
    symptom_cols = [col for col in df.columns if col.startswith('g') and not col.startswith('g1') and col != 'gs_text34']
    admin_cols = [col for col in df.columns if col.startswith('g1')]
    other_cols = [col for col in df.columns if not col.startswith('g')]
    
    # Missing data analysis
    missing_data = {}
    for col in df.columns:
        missing_count = df[col].isnull().sum()
        missing_data[col] = {
            "missing_count": int(missing_count),
            "missing_percentage": float(missing_count / len(df) * 100)
        }
    
    return {
        "basic_info": basic_info,
        "cause_distribution": cause_distribution,
        "column_categories": {
            "symptom_columns": symptom_cols,
            "admin_columns": admin_cols,
            "other_columns": other_cols,
            "target_column": "gs_text34"
        },
        "missing_data": missing_data
    }

if __name__ == "__main__":
    result = explore_phmrc_child()
    print(json.dumps(result, indent=2))
`;
            
            // Save the Python script temporarily
            const scriptPath = path.join(process.cwd(), 'temp_phmrc_exploration.py');
            fs.writeFileSync(scriptPath, pythonScript);
            
            // Execute the Python script
            const pythonResult = await this.executePythonScript(scriptPath);
            
            // Clean up temporary script
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
            
            // Store results in shared memory for other agents
            await this.memory.store('phmrc:exploration:results', pythonResult, 7200, 'shared');
            
            return {
                type: 'phmrc_data_exploration',
                agent: this.name,
                status: 'completed',
                exploration_results: pythonResult,
                timestamp: Date.now()
            };
            
        } catch (error) {
            this.logger.error('PHMRC exploration failed:', error);
            return {
                type: 'phmrc_data_exploration',
                agent: this.name,
                status: 'failed',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    async executePythonScript(scriptPath) {
        return new Promise((resolve, reject) => {
            const python = spawn('python3', [scriptPath]);
            let output = '';
            let errorOutput = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse Python output: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
                }
            });
            
            python.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }
    
    async processResearchTask(taskContext) {
        this.logger.info('Processing research task...');
        
        return {
            type: 'research',
            agent: this.name,
            summary: 'Research completed',
            findings: `Research completed for: ${taskContext.description}`,
            timestamp: Date.now()
        };
    }
    
    async processCoordinationTask(taskContext) {
        this.logger.info('Processing coordination task...');
        
        // Coordinate with other agents if needed
        const otherAgents = Array.from(this.hiveMind.agents.values())
            .filter(agent => agent.id !== this.id && (agent.status === 'idle' || agent.status === 'ready'));
        
        return {
            type: 'coordination',
            agent: this.name,
            summary: 'Coordination completed',
            coordinated_agents: otherAgents.length,
            timestamp: Date.now()
        };
    }
    
    async processGenericTask(taskContext) {
        this.logger.info('Processing generic task...');
        
        return {
            type: 'generic',
            agent: this.name,
            summary: 'Generic task completed',
            details: `Processed: ${taskContext.description}`,
            timestamp: Date.now()
        };
    }
    
    updateMetrics(executionTime, status) {
        this.metrics.totalExecutionTime += executionTime;
        
        if (status === 'completed') {
            this.metrics.tasksCompleted++;
        } else if (status === 'failed') {
            this.metrics.tasksFailed++;
        }
        
        this.metrics.averageExecutionTime = 
            this.metrics.totalExecutionTime / Math.max(this.metrics.tasksCompleted + this.metrics.tasksFailed, 1);
    }
    
    async receiveMessages() {
        if (!this.messageBus) return [];
        
        try {
            const messages = await this.messageBus.receiveMessages(this.id);
            this.metrics.messagesProcessed += messages.length;
            
            for (const message of messages) {
                this.logger.debug(`Received message from ${message.from}: ${message.content}`);
                await this.processMessage(message);
            }
            
            return messages;
        } catch (error) {
            this.logger.error('Failed to receive messages:', error);
            return [];
        }
    }
    
    async processMessage(message) {
        // Simple message processing - can be enhanced based on message content
        if (message.content.includes('status')) {
            await this.sendMessage(message.from, `Status: ${this.status}`, 'normal');
        }
    }
    
    async sendMessage(toAgentId, content, priority = 'normal') {
        if (!this.messageBus) {
            throw new Error('MessageBus not available');
        }
        
        return this.messageBus.sendMessage(this.id, toAgentId, content, priority);
    }
    
    async getSharedMemory(key, namespace = 'shared') {
        if (!this.memory) return null;
        
        return this.memory.retrieve(key, namespace);
    }
    
    async setSharedMemory(key, value, ttl = 3600, namespace = 'shared') {
        if (!this.memory) return false;
        
        return this.memory.store(key, value, ttl, namespace);
    }
    
    getStatus() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            status: this.status,
            currentTask: this.currentTask?.id || null,
            capabilities: this.capabilities,
            metrics: this.metrics,
            namespace: this.namespace
        };
    }
    
    async shutdown() {
        this.logger.info(`Shutting down agent ${this.name}...`);
        
        // Unregister from message bus
        if (this.messageBus) {
            this.messageBus.unregisterAgent(this.id);
        }
        
        // Clear agent namespace in memory
        if (this.memory) {
            const keys = await this.memory.getNamespaceKeys(this.namespace);
            for (const key of keys) {
                await this.memory.delete(key, this.namespace);
            }
        }
        
        this.status = 'shutdown';
        this.logger.info(`Agent ${this.name} shutdown complete`);
    }
}

module.exports = Agent;