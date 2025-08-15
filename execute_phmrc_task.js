#!/usr/bin/env node

/**
 * Execute PHMRC Child Exploration Task using Multi-Agent System
 * Demonstrates the full workflow with distributed memory and agent collaboration
 */

const HiveMind = require('./.claude/core/HiveMind');
const fs = require('fs');
const path = require('path');

class PHMRCTaskExecutor {
    constructor() {
        this.hiveMind = null;
        this.agents = {};
        this.results = {};
    }
    
    async initialize() {
        console.log('🚀 Initializing Multi-Agent System for PHMRC Task...\n');
        
        // Initialize HiveMind with hierarchical topology
        this.hiveMind = new HiveMind({
            topology: 'hierarchical',
            maxAgents: 8,
            name: 'phmrc-analysis'
        });
        
        // Ensure directories exist
        this.ensureDirectories();
        
        console.log('✅ HiveMind initialized successfully\n');
    }
    
    async spawnAgents() {
        console.log('🤖 Spawning specialized agents...\n');
        
        // Spawn data processor agent
        console.log('   Spawning PHMRC Data Processor...');
        this.agents.dataProcessor = await this.hiveMind.spawnAgent('data-processor', 'phmrc-processor');
        
        // Spawn research agent
        console.log('   Spawning Research Agent...');
        this.agents.researcher = await this.hiveMind.spawnAgent('researcher', 'va-researcher');
        
        // Spawn coordinator agent
        console.log('   Spawning Task Coordinator...');
        this.agents.coordinator = await this.hiveMind.spawnAgent('coordinator', 'task-coordinator');
        
        console.log('\n✅ All agents spawned successfully\n');
    }
    
    async executePHMRCExploration() {
        console.log('📊 Executing PHMRC Child Dataset Exploration...\n');
        
        // Task 1: Data processor explores the PHMRC dataset
        console.log('🔍 Task 1: Data Exploration and Validation');
        const explorationResult = await this.hiveMind.orchestrateTask({
            description: 'PHMRC child dataset exploration and validation',
            type: 'data_exploration',
            requirements: [
                'Load PHMRC child dataset',
                'Validate gs_text34 column',
                'Categorize symptom columns',
                'Analyze missing data patterns',
                'Generate statistical summary'
            ]
        }, 'adaptive', 'high');
        
        this.results.exploration = explorationResult;
        console.log('   ✅ Data exploration completed\n');
        
        // Task 2: Research agent gathers context and methodology information
        console.log('📚 Task 2: Research and Context Gathering');
        const researchResult = await this.hiveMind.orchestrateTask({
            description: 'Research PHMRC dataset context and VA methodologies',
            type: 'research',
            requirements: [
                'PHMRC study background',
                'VA methodology comparison',
                'Data processing best practices',
                'Evaluation metrics for cause prediction'
            ]
        }, 'sequential', 'normal');
        
        this.results.research = researchResult;
        console.log('   ✅ Research completed\n');
        
        // Task 3: Coordinator synthesizes results and creates comprehensive report
        console.log('📋 Task 3: Result Coordination and Synthesis');
        const coordinationResult = await this.hiveMind.orchestrateTask({
            description: 'Coordinate PHMRC exploration results and generate comprehensive report',
            type: 'coordination',
            requirements: [
                'Aggregate exploration findings',
                'Incorporate research context',
                'Generate final report',
                'Create recommendations'
            ]
        }, 'hierarchical', 'high');
        
        this.results.coordination = coordinationResult;
        console.log('   ✅ Coordination completed\n');
    }
    
    async generateResults() {
        console.log('📝 Generating comprehensive results...\n');
        
        // Get shared memory contents
        const memoryResults = await this.getSharedMemoryResults();
        
        // Get agent metrics
        const swarmStatus = await this.hiveMind.getStatus();
        
        // Generate final report
        const report = {
            timestamp: new Date().toISOString(),
            task: 'PHMRC Child Dataset Exploration',
            methodology: 'Multi-Agent Orchestration with Distributed Memory',
            swarmConfiguration: {
                topology: swarmStatus.topology,
                agentsUsed: swarmStatus.activeAgents,
                totalTasks: swarmStatus.metrics.tasksCompleted,
                totalExecutionTime: swarmStatus.metrics.totalExecutionTime
            },
            agentCollaboration: {
                dataProcessor: this.getAgentSummary('phmrc-processor'),
                researcher: this.getAgentSummary('va-researcher'),
                coordinator: this.getAgentSummary('task-coordinator')
            },
            taskResults: this.results,
            memoryUsage: {
                distributedMemoryStats: swarmStatus.memoryStats,
                sharedResults: memoryResults
            },
            systemPerformance: {
                averageTaskTime: swarmStatus.metrics.totalExecutionTime / Math.max(swarmStatus.metrics.tasksCompleted, 1),
                memoryHitRate: swarmStatus.memoryStats.hitRate,
                agentEfficiency: this.calculateAgentEfficiency(swarmStatus)
            }
        };
        
        // Save results
        await this.saveResults(report);
        
        return report;
    }
    
    async getSharedMemoryResults() {
        const memory = this.hiveMind.memory;
        const results = {};
        
        try {
            // Get PHMRC exploration results
            const phmrcResults = await memory.retrieve('phmrc:exploration:results', 'shared');
            if (phmrcResults) {
                results.phmrcExploration = phmrcResults;
            }
            
            // Get all keys in shared namespace to see what else is available
            const sharedKeys = await memory.getNamespaceKeys('shared');
            results.availableKeys = sharedKeys;
            
        } catch (error) {
            console.warn('Could not retrieve all shared memory results:', error.message);
        }
        
        return results;
    }
    
    getAgentSummary(agentName) {
        const agent = Array.from(this.hiveMind.agents.values()).find(a => a.name === agentName);
        if (!agent) return { status: 'not found' };
        
        return {
            id: agent.id,
            type: agent.type,
            status: agent.status,
            metrics: agent.metrics,
            capabilities: agent.capabilities
        };
    }
    
    calculateAgentEfficiency(status) {
        const totalAgents = status.activeAgents;
        const totalTasks = status.metrics.tasksCompleted;
        const totalTime = status.metrics.totalExecutionTime;
        
        return {
            tasksPerAgent: totalAgents > 0 ? totalTasks / totalAgents : 0,
            averageTimePerTask: totalTasks > 0 ? totalTime / totalTasks : 0,
            systemUtilization: totalAgents > 0 ? (totalTasks / totalAgents) / status.maxAgents : 0
        };
    }
    
    async saveResults(report) {
        // Save to data_exploration/results directory
        const resultsDir = 'data_exploration/results';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Main report
        const reportPath = path.join(resultsDir, `phmrc_exploration_report_${timestamp}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Extract specific results for traditional files
        if (report.memoryUsage.sharedResults.phmrcExploration) {
            const exploration = report.memoryUsage.sharedResults.phmrcExploration;
            
            // Save cause distribution
            if (exploration.cause_distribution) {
                const causePath = path.join(resultsDir, 'child_cause_distribution.csv');
                const causeCSV = this.objectToCSV(exploration.cause_distribution, 'cause', 'count');
                fs.writeFileSync(causePath, causeCSV);
            }
            
            // Save column info
            if (exploration.column_categories) {
                const columnPath = path.join(resultsDir, 'child_column_info.csv');
                const columnCSV = this.generateColumnInfoCSV(exploration);
                fs.writeFileSync(columnPath, columnCSV);
            }
            
            // Save dataset summary
            const summaryPath = path.join(resultsDir, 'child_dataset_summary.txt');
            const summary = this.generateDatasetSummary(exploration, report);
            fs.writeFileSync(summaryPath, summary);
        }
        
        console.log(`📁 Results saved to: ${resultsDir}/`);
        console.log(`   📊 Main report: ${reportPath}`);
        console.log(`   📈 Cause distribution: child_cause_distribution.csv`);
        console.log(`   📋 Column info: child_column_info.csv`);
        console.log(`   📄 Dataset summary: child_dataset_summary.txt\n`);
    }
    
    objectToCSV(obj, keyHeader, valueHeader) {
        let csv = `${keyHeader},${valueHeader}\n`;
        for (const [key, value] of Object.entries(obj)) {
            csv += `"${key}",${value}\n`;
        }
        return csv;
    }
    
    generateColumnInfoCSV(exploration) {
        let csv = 'column_name,category,description\n';
        
        const categories = exploration.column_categories;
        
        // Target column
        csv += `"${categories.target_column}",label,"Gold standard cause of death (34 categories)"\n`;
        
        // Symptom columns
        if (categories.symptom_columns) {
            categories.symptom_columns.forEach(col => {
                csv += `"${col}",feature,"Symptom indicator column"\n`;
            });
        }
        
        // Administrative columns
        if (categories.admin_columns) {
            categories.admin_columns.forEach(col => {
                csv += `"${col}",drop,"Administrative metadata column"\n`;
            });
        }
        
        // Other columns
        if (categories.other_columns) {
            categories.other_columns.forEach(col => {
                csv += `"${col}",other,"Other data column"\n`;
            });
        }
        
        return csv;
    }
    
    generateDatasetSummary(exploration, report) {
        return `
PHMRC Child Dataset Exploration Summary
======================================

Generated: ${new Date().toISOString()}
Multi-Agent System: ${report.swarmConfiguration.topology} topology
Execution Time: ${report.swarmConfiguration.totalExecutionTime}ms

Dataset Overview:
-----------------
Total Rows: ${exploration.basic_info?.n_rows || 'N/A'}
Total Columns: ${exploration.basic_info?.n_cols || 'N/A'}

Column Categories:
------------------
Target Column: ${exploration.column_categories?.target_column || 'N/A'}
Symptom Columns: ${exploration.column_categories?.symptom_columns?.length || 0}
Administrative Columns: ${exploration.column_categories?.admin_columns?.length || 0}
Other Columns: ${exploration.column_categories?.other_columns?.length || 0}

Cause Distribution Summary:
---------------------------
Unique Causes: ${Object.keys(exploration.cause_distribution || {}).length}
Most Common Cause: ${this.getMostCommonCause(exploration.cause_distribution)}

Multi-Agent Collaboration:
---------------------------
Data Processor: Loaded and analyzed dataset structure
Researcher: Provided methodological context
Coordinator: Synthesized results and generated reports

Memory System Performance:
---------------------------
Memory Hit Rate: ${(report.swarmConfiguration.memoryUsage?.hitRate * 100 || 0).toFixed(2)}%
Shared Memory Items: ${report.memoryUsage.distributedMemoryStats?.cacheSize || 0}

Recommendations:
----------------
1. Use symptom columns (g-prefixed, non-g1) for model training
2. Drop administrative columns (g1-prefixed) before modeling
3. Consider missing data patterns in feature engineering
4. Validate cause categories against expected PHMRC taxonomy

Agent Performance:
------------------
${Object.entries(report.agentCollaboration).map(([name, agent]) => 
    `${name}: ${agent.metrics?.tasksCompleted || 0} tasks completed`
).join('\n')}
        `.trim();
    }
    
    getMostCommonCause(distribution) {
        if (!distribution) return 'N/A';
        
        let maxCause = '';
        let maxCount = 0;
        
        for (const [cause, count] of Object.entries(distribution)) {
            if (count > maxCount) {
                maxCount = count;
                maxCause = cause;
            }
        }
        
        return `${maxCause} (${maxCount} cases)`;
    }
    
    ensureDirectories() {
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
    
    async shutdown() {
        console.log('🔄 Shutting down multi-agent system...\n');
        
        if (this.hiveMind) {
            await this.hiveMind.shutdown();
        }
        
        console.log('✅ Shutdown complete\n');
    }
    
    displayFinalSummary(report) {
        console.log('=' .repeat(60));
        console.log('🎯 PHMRC CHILD EXPLORATION - EXECUTION COMPLETE');
        console.log('=' .repeat(60));
        console.log(`⏱️  Total Execution Time: ${report.swarmConfiguration.totalExecutionTime}ms`);
        console.log(`🤖 Agents Used: ${report.swarmConfiguration.agentsUsed}`);
        console.log(`📋 Tasks Completed: ${report.swarmConfiguration.totalTasks}`);
        console.log(`💾 Memory Hit Rate: ${(report.swarmConfiguration.memoryUsage?.hitRate * 100 || 0).toFixed(2)}%`);
        console.log('=' .repeat(60));
        
        if (report.memoryUsage.sharedResults.phmrcExploration) {
            const exp = report.memoryUsage.sharedResults.phmrcExploration;
            console.log(`📊 Dataset: ${exp.basic_info?.n_rows || 'N/A'} rows, ${exp.basic_info?.n_cols || 'N/A'} columns`);
            console.log(`🎯 Causes Found: ${Object.keys(exp.cause_distribution || {}).length}`);
            console.log(`📈 Symptom Columns: ${exp.column_categories?.symptom_columns?.length || 0}`);
        }
        
        console.log('=' .repeat(60));
        console.log('🎉 Multi-Agent PHMRC exploration successfully completed!');
        console.log('=' .repeat(60));
    }
}

// Execute the PHMRC task
async function main() {
    const executor = new PHMRCTaskExecutor();
    
    try {
        await executor.initialize();
        await executor.spawnAgents();
        await executor.executePHMRCExploration();
        
        const finalReport = await executor.generateResults();
        executor.displayFinalSummary(finalReport);
        
    } catch (error) {
        console.error('❌ Task execution failed:', error.message);
        console.error(error.stack);
    } finally {
        await executor.shutdown();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = PHMRCTaskExecutor;