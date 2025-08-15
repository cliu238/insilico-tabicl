const { v4: generateUUID } = require('uuid');
const Logger = require('../core/Logger');

/**
 * TaskContext - Manages task execution context and cross-agent collaboration
 * 
 * Provides structured context management for complex tasks that span multiple agents,
 * enabling proper state tracking, result sharing, and collaboration coordination
 */
class TaskContext {
  constructor(taskId, hiveMind, options = {}) {
    this.taskId = taskId || generateUUID();
    this.hiveMind = hiveMind;
    this.memory = hiveMind.memory;
    this.logger = new Logger('info');
    
    // Context configuration
    this.namespace = `task:${this.taskId}`;
    this.sharedNamespace = 'shared';
    this.ttl = options.ttl || 7200; // 2 hours default
    
    // Task state
    this.status = 'initialized';
    this.createdAt = new Date().toISOString();
    this.currentAgent = null;
    this.assignedAgents = new Set();
    this.completedSteps = [];
    this.activeSteps = new Map();
    
    // Collaboration tracking
    this.dependencies = new Map(); // step -> [dependent_steps]
    this.results = new Map(); // agent_id -> result
    this.sharedData = new Map(); // key -> data
    this.checkpoints = [];
    
    this.logger.info('TaskContext created', {
      taskId: this.taskId,
      namespace: this.namespace
    });
  }

  /**
   * Initialize the task context
   */
  async initialize(taskDescription, metadata = {}) {
    try {
      // Store task metadata
      await this.memory.store(this.namespace, 'metadata', {
        taskId: this.taskId,
        description: taskDescription,
        status: this.status,
        createdAt: this.createdAt,
        ...metadata
      }, { ttl: this.ttl });
      
      // Initialize progress tracking
      await this.memory.store(this.namespace, 'progress', {
        steps: [],
        completedSteps: [],
        activeSteps: {},
        totalSteps: 0,
        completionPercentage: 0
      }, { ttl: this.ttl });
      
      // Initialize collaboration space
      await this.memory.store(this.namespace, 'collaboration', {
        assignedAgents: [],
        results: {},
        sharedData: {},
        dependencies: {}
      }, { ttl: this.ttl });
      
      this.status = 'active';
      this.logger.info('TaskContext initialized', {
        taskId: this.taskId,
        description: taskDescription
      });
      
    } catch (error) {
      this.status = 'error';
      this.logger.error('TaskContext initialization failed', {
        taskId: this.taskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Register an agent with this task context
   */
  async registerAgent(agentId, role = 'participant') {
    try {
      this.assignedAgents.add(agentId);
      
      // Create agent-specific workspace
      await this.memory.store(this.namespace, `agent:${agentId}`, {
        agentId,
        role,
        joinedAt: new Date().toISOString(),
        status: 'joined',
        assignedSteps: [],
        completedSteps: []
      }, { ttl: this.ttl });
      
      // Update collaboration tracking
      const collaboration = await this.memory.retrieve(this.namespace, 'collaboration') || {};
      collaboration.assignedAgents = Array.from(this.assignedAgents);
      await this.memory.store(this.namespace, 'collaboration', collaboration, { ttl: this.ttl });
      
      this.logger.info('Agent registered with task context', {
        taskId: this.taskId,
        agentId,
        role
      });
      
    } catch (error) {
      this.logger.error('Failed to register agent', {
        taskId: this.taskId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start a new step in the task execution
   */
  async startStep(stepId, description, agentId, dependencies = []) {
    try {
      const step = {
        stepId,
        description,
        agentId,
        dependencies,
        startedAt: new Date().toISOString(),
        status: 'active',
        progress: 0
      };
      
      this.activeSteps.set(stepId, step);
      this.currentAgent = agentId;
      
      // Store step information
      await this.memory.store(this.namespace, `step:${stepId}`, step, { ttl: this.ttl });
      
      // Update progress tracking
      await this.updateProgress();
      
      // Update agent workspace
      const agentData = await this.memory.retrieve(this.namespace, `agent:${agentId}`) || {};
      agentData.assignedSteps = agentData.assignedSteps || [];
      agentData.assignedSteps.push(stepId);
      agentData.status = 'working';
      await this.memory.store(this.namespace, `agent:${agentId}`, agentData, { ttl: this.ttl });
      
      this.logger.info('Task step started', {
        taskId: this.taskId,
        stepId,
        agentId,
        dependencies
      });
      
      return step;
      
    } catch (error) {
      this.logger.error('Failed to start step', {
        taskId: this.taskId,
        stepId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update progress for a specific step
   */
  async updateStepProgress(stepId, progress, data = {}) {
    try {
      const step = await this.memory.retrieve(this.namespace, `step:${stepId}`);
      if (!step) {
        throw new Error(`Step ${stepId} not found`);
      }
      
      step.progress = progress;
      step.lastUpdated = new Date().toISOString();
      step.data = data;
      
      await this.memory.store(this.namespace, `step:${stepId}`, step, { ttl: this.ttl });
      
      // Update overall progress
      await this.updateProgress();
      
      this.logger.debug('Step progress updated', {
        taskId: this.taskId,
        stepId,
        progress
      });
      
    } catch (error) {
      this.logger.error('Failed to update step progress', {
        taskId: this.taskId,
        stepId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Complete a step and store its result
   */
  async completeStep(stepId, result, agentId) {
    try {
      const step = await this.memory.retrieve(this.namespace, `step:${stepId}`);
      if (!step) {
        throw new Error(`Step ${stepId} not found`);
      }
      
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      step.result = result;
      step.progress = 100;
      
      // Store completed step
      await this.memory.store(this.namespace, `step:${stepId}`, step, { ttl: this.ttl });
      
      // Move from active to completed
      this.activeSteps.delete(stepId);
      this.completedSteps.push(step);
      
      // Update agent workspace
      const agentData = await this.memory.retrieve(this.namespace, `agent:${agentId}`) || {};
      agentData.completedSteps = agentData.completedSteps || [];
      agentData.completedSteps.push(stepId);
      agentData.status = this.hasActiveSteps(agentId) ? 'working' : 'idle';
      await this.memory.store(this.namespace, `agent:${agentId}`, agentData, { ttl: this.ttl });
      
      // Store result in collaboration space
      await this.storeResult(agentId, result);
      
      // Update overall progress
      await this.updateProgress();
      
      this.logger.info('Task step completed', {
        taskId: this.taskId,
        stepId,
        agentId
      });
      
      return step;
      
    } catch (error) {
      this.logger.error('Failed to complete step', {
        taskId: this.taskId,
        stepId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Store result from an agent
   */
  async storeResult(agentId, result) {
    try {
      const timestamp = new Date().toISOString();
      
      // Store in agent-specific results
      await this.memory.store(this.namespace, `result:${agentId}`, {
        agentId,
        result,
        timestamp
      }, { ttl: this.ttl });
      
      // Update collaboration results
      const collaboration = await this.memory.retrieve(this.namespace, 'collaboration') || {};
      collaboration.results = collaboration.results || {};
      collaboration.results[agentId] = { result, timestamp };
      await this.memory.store(this.namespace, 'collaboration', collaboration, { ttl: this.ttl });
      
      this.results.set(agentId, result);
      
      this.logger.debug('Result stored for agent', {
        taskId: this.taskId,
        agentId
      });
      
    } catch (error) {
      this.logger.error('Failed to store result', {
        taskId: this.taskId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Share data between agents
   */
  async shareData(key, data, fromAgent = null) {
    try {
      // Store in shared space accessible to all agents
      await this.memory.store(this.sharedNamespace, `${this.taskId}:${key}`, {
        data,
        fromAgent,
        sharedAt: new Date().toISOString()
      }, { ttl: this.ttl });
      
      // Update local tracking
      this.sharedData.set(key, data);
      
      // Update collaboration tracking
      const collaboration = await this.memory.retrieve(this.namespace, 'collaboration') || {};
      collaboration.sharedData = collaboration.sharedData || {};
      collaboration.sharedData[key] = { fromAgent, sharedAt: new Date().toISOString() };
      await this.memory.store(this.namespace, 'collaboration', collaboration, { ttl: this.ttl });
      
      this.logger.info('Data shared in task context', {
        taskId: this.taskId,
        key,
        fromAgent
      });
      
    } catch (error) {
      this.logger.error('Failed to share data', {
        taskId: this.taskId,
        key,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get shared data
   */
  async getSharedData(key) {
    try {
      const sharedEntry = await this.memory.retrieve(this.sharedNamespace, `${this.taskId}:${key}`);
      return sharedEntry ? sharedEntry.data : null;
      
    } catch (error) {
      this.logger.error('Failed to get shared data', {
        taskId: this.taskId,
        key,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get all results from agents
   */
  async getAllResults() {
    try {
      const results = [];
      const collaboration = await this.memory.retrieve(this.namespace, 'collaboration') || {};
      
      for (const [agentId, resultData] of Object.entries(collaboration.results || {})) {
        results.push({
          agentId,
          result: resultData.result,
          timestamp: resultData.timestamp
        });
      }
      
      return results;
      
    } catch (error) {
      this.logger.error('Failed to get all results', {
        taskId: this.taskId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get progress summary
   */
  async getProgress() {
    try {
      const progress = await this.memory.retrieve(this.namespace, 'progress') || {};
      
      // Calculate completion percentage
      const totalSteps = this.completedSteps.length + this.activeSteps.size;
      progress.totalSteps = totalSteps;
      progress.completedSteps = this.completedSteps.map(step => step.stepId);
      progress.activeSteps = Object.fromEntries(this.activeSteps);
      progress.completionPercentage = totalSteps > 0 ? (this.completedSteps.length / totalSteps) * 100 : 0;
      
      return progress;
      
    } catch (error) {
      this.logger.error('Failed to get progress', {
        taskId: this.taskId,
        error: error.message
      });
      return { completionPercentage: 0, totalSteps: 0 };
    }
  }

  /**
   * Update overall progress tracking
   */
  async updateProgress() {
    try {
      const progress = await this.getProgress();
      await this.memory.store(this.namespace, 'progress', progress, { ttl: this.ttl });
      
    } catch (error) {
      this.logger.error('Failed to update progress', {
        taskId: this.taskId,
        error: error.message
      });
    }
  }

  /**
   * Check if agent has active steps
   */
  hasActiveSteps(agentId) {
    for (const step of this.activeSteps.values()) {
      if (step.agentId === agentId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a checkpoint of current state
   */
  async createCheckpoint(description = '') {
    try {
      const checkpoint = {
        id: generateUUID(),
        description,
        createdAt: new Date().toISOString(),
        progress: await this.getProgress(),
        results: await this.getAllResults(),
        activeSteps: Object.fromEntries(this.activeSteps),
        assignedAgents: Array.from(this.assignedAgents)
      };
      
      this.checkpoints.push(checkpoint);
      
      await this.memory.store(this.namespace, `checkpoint:${checkpoint.id}`, checkpoint, { ttl: this.ttl });
      
      this.logger.info('Checkpoint created', {
        taskId: this.taskId,
        checkpointId: checkpoint.id,
        description
      });
      
      return checkpoint;
      
    } catch (error) {
      this.logger.error('Failed to create checkpoint', {
        taskId: this.taskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get collaborative context for an agent
   */
  async getCollaborativeContext(agentId) {
    try {
      const context = {
        taskId: this.taskId,
        taskMetadata: await this.memory.retrieve(this.namespace, 'metadata'),
        progress: await this.getProgress(),
        allResults: await this.getAllResults(),
        sharedData: {},
        assignedAgents: Array.from(this.assignedAgents),
        agentWorkspace: await this.memory.retrieve(this.namespace, `agent:${agentId}`)
      };
      
      // Get all shared data for this task
      const collaboration = await this.memory.retrieve(this.namespace, 'collaboration') || {};
      for (const key of Object.keys(collaboration.sharedData || {})) {
        context.sharedData[key] = await this.getSharedData(key);
      }
      
      return context;
      
    } catch (error) {
      this.logger.error('Failed to get collaborative context', {
        taskId: this.taskId,
        agentId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Complete the entire task
   */
  async completeTask(finalResult = null) {
    try {
      this.status = 'completed';
      
      // Store final result
      const taskCompletion = {
        taskId: this.taskId,
        status: this.status,
        completedAt: new Date().toISOString(),
        finalResult,
        allResults: await this.getAllResults(),
        progress: await this.getProgress(),
        duration: Date.now() - new Date(this.createdAt).getTime()
      };
      
      await this.memory.store(this.namespace, 'completion', taskCompletion, { ttl: this.ttl * 2 }); // Keep completion longer
      
      // Update metadata
      const metadata = await this.memory.retrieve(this.namespace, 'metadata') || {};
      metadata.status = this.status;
      metadata.completedAt = taskCompletion.completedAt;
      await this.memory.store(this.namespace, 'metadata', metadata, { ttl: this.ttl * 2 });
      
      this.logger.info('Task completed', {
        taskId: this.taskId,
        duration: taskCompletion.duration
      });
      
      return taskCompletion;
      
    } catch (error) {
      this.status = 'error';
      this.logger.error('Failed to complete task', {
        taskId: this.taskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get task summary
   */
  async getSummary() {
    try {
      return {
        taskId: this.taskId,
        status: this.status,
        metadata: await this.memory.retrieve(this.namespace, 'metadata'),
        progress: await this.getProgress(),
        assignedAgents: Array.from(this.assignedAgents),
        resultsCount: this.results.size,
        checkpointsCount: this.checkpoints.length,
        createdAt: this.createdAt
      };
      
    } catch (error) {
      this.logger.error('Failed to get task summary', {
        taskId: this.taskId,
        error: error.message
      });
      return null;
    }
  }
}

module.exports = TaskContext;