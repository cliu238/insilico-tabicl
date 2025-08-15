const { v4: generateUUID } = require('uuid');
const TaskContext = require('../memory/TaskContext');
const Logger = require('../core/Logger');

/**
 * TaskOrchestrator - Intelligent task distribution and coordination system
 * 
 * Manages task decomposition, agent assignment, and execution coordination
 * across the multi-agent swarm with support for different orchestration strategies
 */
class TaskOrchestrator {
  constructor(hiveMind) {
    this.hiveMind = hiveMind;
    this.logger = new Logger('info');
    
    // Orchestration strategies
    this.strategies = {
      ADAPTIVE: 'adaptive',
      SEQUENTIAL: 'sequential', 
      PARALLEL: 'parallel',
      HIERARCHICAL: 'hierarchical'
    };
    
    // Task execution state
    this.activeTasks = new Map();
    this.taskContexts = new Map();
    this.executionGraph = new Map(); // Task dependencies
    
    this.logger.info('TaskOrchestrator initialized');
  }

  /**
   * Main orchestration entry point
   */
  async orchestrateTask(taskDescription, options = {}) {
    const taskId = generateUUID();
    const strategy = options.strategy || this.strategies.ADAPTIVE;
    
    try {
      this.logger.info('Starting task orchestration', {
        taskId,
        strategy,
        description: taskDescription
      });
      
      // Create task context
      const taskContext = new TaskContext(taskId, this.hiveMind, {
        ttl: options.ttl || 7200
      });
      await taskContext.initialize(taskDescription, {
        strategy,
        priority: options.priority || 'medium',
        requestedAgents: options.requestedAgents,
        context: options.context || {}
      });
      
      this.taskContexts.set(taskId, taskContext);
      
      // Create execution plan
      const executionPlan = await this.createExecutionPlan(taskDescription, options, taskContext);
      
      // Execute based on strategy
      let result;
      switch (strategy) {
        case this.strategies.SEQUENTIAL:
          result = await this.executeSequential(executionPlan, taskContext);
          break;
        case this.strategies.PARALLEL:
          result = await this.executeParallel(executionPlan, taskContext);
          break;
        case this.strategies.HIERARCHICAL:
          result = await this.executeHierarchical(executionPlan, taskContext);
          break;
        case this.strategies.ADAPTIVE:
        default:
          result = await this.executeAdaptive(executionPlan, taskContext);
          break;
      }
      
      // Complete task context
      const completionResult = await taskContext.completeTask(result);
      
      this.logger.info('Task orchestration completed', {
        taskId,
        duration: completionResult.duration
      });
      
      return {
        taskId,
        result,
        executionPlan,
        taskContext: await taskContext.getSummary(),
        metadata: {
          strategy,
          duration: completionResult.duration,
          agentsUsed: completionResult.allResults.length,
          completedAt: completionResult.completedAt
        }
      };
      
    } catch (error) {
      this.logger.error('Task orchestration failed', {
        taskId,
        error: error.message
      });
      
      if (this.taskContexts.has(taskId)) {
        const taskContext = this.taskContexts.get(taskId);
        taskContext.status = 'error';
      }
      
      throw error;
    } finally {
      // Cleanup
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Create execution plan based on task analysis
   */
  async createExecutionPlan(taskDescription, options, taskContext) {
    // Use planner agent if available in hierarchical topology
    if (this.hiveMind.topology === 'hierarchical') {
      const plannerAgent = this.hiveMind.getAgentsByType('planner')[0];
      if (plannerAgent) {
        return await this.createPlanWithPlanner(taskDescription, options, taskContext, plannerAgent);
      }
    }
    
    // Fallback to built-in planning logic
    return await this.createBuiltinPlan(taskDescription, options, taskContext);
  }

  /**
   * Create plan using planner agent
   */
  async createPlanWithPlanner(taskDescription, options, taskContext, plannerAgent) {
    await taskContext.registerAgent(plannerAgent.id, 'planner');
    
    const planningTask = {
      id: generateUUID(),
      description: `Create execution plan for: ${taskDescription}`,
      context: {
        availableAgents: this.getAvailableAgentCapabilities(),
        strategy: options.strategy,
        priority: options.priority,
        constraints: options.constraints || {}
      }
    };
    
    await taskContext.startStep('planning', 'Create execution plan', plannerAgent.id);
    
    const planResult = await plannerAgent.executeTask(planningTask);
    
    await taskContext.completeStep('planning', planResult, plannerAgent.id);
    
    // Parse planning result
    const executionPlan = this.parsePlanningResult(planResult.result);
    
    this.logger.info('Execution plan created by planner', {
      taskId: taskContext.taskId,
      phases: executionPlan.phases.length,
      totalTasks: executionPlan.tasks.length
    });
    
    return executionPlan;
  }

  /**
   * Create plan using built-in logic
   */
  async createBuiltinPlan(taskDescription, options, taskContext) {
    // Simple heuristic-based planning
    const plan = {
      objective: taskDescription,
      strategy: options.strategy || 'adaptive',
      phases: [],
      tasks: [],
      dependencies: new Map(),
      estimatedDuration: 0
    };
    
    // Analyze task type and create appropriate plan
    if (this.isDataAnalysisTask(taskDescription)) {
      plan.phases = this.createDataAnalysisPlan(taskDescription, options);
    } else if (this.isModelTrainingTask(taskDescription)) {
      plan.phases = this.createModelTrainingPlan(taskDescription, options);
    } else if (this.isResearchTask(taskDescription)) {
      plan.phases = this.createResearchPlan(taskDescription, options);
    } else {
      plan.phases = this.createGenericPlan(taskDescription, options);
    }
    
    // Flatten phases into tasks
    let taskIndex = 0;
    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        task.id = task.id || `task-${++taskIndex}`;
        task.phase = phase.name;
        plan.tasks.push(task);
        plan.estimatedDuration += task.estimatedTime || 15; // Default 15 minutes
      }
    }
    
    this.logger.info('Built-in execution plan created', {
      taskId: taskContext.taskId,
      phases: plan.phases.length,
      totalTasks: plan.tasks.length,
      estimatedDuration: plan.estimatedDuration
    });
    
    return plan;
  }

  /**
   * Execute tasks sequentially
   */
  async executeSequential(executionPlan, taskContext) {
    const results = [];
    
    for (const task of executionPlan.tasks) {
      // Check dependencies
      await this.waitForDependencies(task, taskContext);
      
      // Assign and execute task
      const result = await this.executeTask(task, taskContext);
      results.push(result);
      
      // Share intermediate results
      await taskContext.shareData(`task_${task.id}_result`, result);
    }
    
    return this.aggregateResults(results, executionPlan);
  }

  /**
   * Execute tasks in parallel where possible
   */
  async executeParallel(executionPlan, taskContext) {
    const taskPromises = new Map();
    const results = [];
    
    // Group tasks by dependency level
    const dependencyLevels = this.calculateDependencyLevels(executionPlan.tasks);
    
    for (const level of dependencyLevels) {
      const levelPromises = [];
      
      for (const task of level) {
        const promise = this.executeTask(task, taskContext);
        taskPromises.set(task.id, promise);
        levelPromises.push(promise);
      }
      
      // Wait for all tasks in this level to complete
      const levelResults = await Promise.all(levelPromises);
      results.push(...levelResults);
      
      // Share intermediate results for next level
      for (let i = 0; i < level.length; i++) {
        await taskContext.shareData(`task_${level[i].id}_result`, levelResults[i]);
      }
    }
    
    return this.aggregateResults(results, executionPlan);
  }

  /**
   * Execute tasks hierarchically through Queen agent
   */
  async executeHierarchical(executionPlan, taskContext) {
    if (!this.hiveMind.queen) {
      throw new Error('Hierarchical execution requires Queen agent');
    }
    
    // Delegate execution to Queen agent
    const hierarchicalTask = {
      id: generateUUID(),
      description: `Execute hierarchical plan: ${executionPlan.objective}`,
      context: {
        executionPlan,
        taskContext: taskContext.taskId
      }
    };
    
    await taskContext.registerAgent(this.hiveMind.queen.id, 'coordinator');
    await taskContext.startStep('hierarchical_execution', 'Execute via Queen coordination', this.hiveMind.queen.id);
    
    const result = await this.hiveMind.queen.executeTask(hierarchicalTask);
    
    await taskContext.completeStep('hierarchical_execution', result, this.hiveMind.queen.id);
    
    return result;
  }

  /**
   * Adaptive execution that chooses best strategy
   */
  async executeAdaptive(executionPlan, taskContext) {
    const taskCount = executionPlan.tasks.length;
    const complexity = this.assessPlanComplexity(executionPlan);
    const availableAgents = this.hiveMind.getAvailableAgents().length;
    
    // Choose strategy based on task characteristics
    let chosenStrategy;
    
    if (taskCount === 1) {
      // Single task - direct execution
      chosenStrategy = 'direct';
    } else if (complexity === 'high' && availableAgents >= 3) {
      // Complex task with multiple agents - hierarchical
      chosenStrategy = this.strategies.HIERARCHICAL;
    } else if (this.hasParallelizableTasks(executionPlan) && availableAgents >= 2) {
      // Parallelizable tasks with sufficient agents
      chosenStrategy = this.strategies.PARALLEL;
    } else {
      // Default to sequential
      chosenStrategy = this.strategies.SEQUENTIAL;
    }
    
    this.logger.info('Adaptive strategy selected', {
      taskId: taskContext.taskId,
      chosenStrategy,
      taskCount,
      complexity,
      availableAgents
    });
    
    // Execute with chosen strategy
    switch (chosenStrategy) {
      case 'direct':
        return await this.executeDirectTask(executionPlan.tasks[0], taskContext);
      case this.strategies.HIERARCHICAL:
        return await this.executeHierarchical(executionPlan, taskContext);
      case this.strategies.PARALLEL:
        return await this.executeParallel(executionPlan, taskContext);
      default:
        return await this.executeSequential(executionPlan, taskContext);
    }
  }

  /**
   * Execute a single task directly
   */
  async executeDirectTask(task, taskContext) {
    return await this.executeTask(task, taskContext);
  }

  /**
   * Execute individual task with agent assignment
   */
  async executeTask(task, taskContext) {
    // Find suitable agent
    const agent = await this.assignAgent(task, taskContext);
    
    if (!agent) {
      throw new Error(`No suitable agent found for task: ${task.description}`);
    }
    
    // Register agent with task context
    await taskContext.registerAgent(agent.id, 'executor');
    
    // Start task execution
    await taskContext.startStep(task.id, task.description, agent.id, task.dependencies || []);
    
    try {
      // Execute task
      const result = await agent.executeTask({
        id: task.id,
        description: task.description,
        context: task.context || {},
        priority: task.priority || 'medium'
      });
      
      // Complete step
      await taskContext.completeStep(task.id, result, agent.id);
      
      this.logger.info('Task executed successfully', {
        taskId: task.id,
        agentId: agent.id,
        agentType: agent.type
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Task execution failed', {
        taskId: task.id,
        agentId: agent.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Assign most suitable agent to a task
   */
  async assignAgent(task, taskContext) {
    const availableAgents = this.hiveMind.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      return null;
    }
    
    // Score agents based on capability match
    const scoredAgents = availableAgents.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent, task)
    }));
    
    // Sort by score (descending)
    scoredAgents.sort((a, b) => b.score - a.score);
    
    return scoredAgents[0].agent;
  }

  /**
   * Calculate agent suitability score for a task
   */
  calculateAgentScore(agent, task) {
    let score = 0;
    
    // Base score for agent being available
    score += 10;
    
    // Capability matching
    const requiredCapabilities = task.requiredCapabilities || this.inferRequiredCapabilities(task);
    for (const capability of requiredCapabilities) {
      if (agent.capabilities.includes(capability)) {
        score += 20;
      }
    }
    
    // Agent type matching
    const preferredTypes = this.inferPreferredAgentTypes(task);
    if (preferredTypes.includes(agent.type)) {
      score += 15;
    }
    
    // Performance history (if available)
    score += Math.min(agent.tasksCompleted, 10); // Max 10 points for experience
    
    // Load balancing (prefer less utilized agents)
    score -= agent.currentTasks.size * 5;
    
    return score;
  }

  /**
   * Wait for task dependencies to complete
   */
  async waitForDependencies(task, taskContext) {
    if (!task.dependencies || task.dependencies.length === 0) {
      return;
    }
    
    // Check if dependencies are completed
    const completedSteps = await taskContext.getProgress();
    const completed = completedSteps.completedSteps || [];
    
    for (const dependency of task.dependencies) {
      if (!completed.includes(dependency)) {
        // Wait for dependency (simplified - in production, use proper event-driven approach)
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await this.waitForDependencies(task, taskContext);
      }
    }
  }

  /**
   * Aggregate results from multiple tasks
   */
  aggregateResults(results, executionPlan) {
    return {
      summary: `Completed ${results.length} tasks for: ${executionPlan.objective}`,
      totalTasks: results.length,
      successfulTasks: results.filter(r => r && !r.error).length,
      results: results,
      executionPlan: {
        objective: executionPlan.objective,
        strategy: executionPlan.strategy,
        phases: executionPlan.phases.length,
        estimatedDuration: executionPlan.estimatedDuration
      }
    };
  }

  /**
   * Get available agent capabilities summary
   */
  getAvailableAgentCapabilities() {
    const agents = this.hiveMind.getAvailableAgents();
    const capabilities = new Set();
    
    for (const agent of agents) {
      for (const capability of agent.capabilities) {
        capabilities.add(capability);
      }
    }
    
    return {
      agentCount: agents.length,
      agentTypes: [...new Set(agents.map(a => a.type))],
      capabilities: [...capabilities],
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        capabilities: a.capabilities,
        status: a.status
      }))
    };
  }

  // Task type detection methods
  isDataAnalysisTask(description) {
    const keywords = ['analyze', 'data', 'dataset', 'explore', 'statistics', 'quality'];
    return keywords.some(keyword => description.toLowerCase().includes(keyword));
  }

  isModelTrainingTask(description) {
    const keywords = ['train', 'model', 'machine learning', 'ml', 'neural network', 'algorithm'];
    return keywords.some(keyword => description.toLowerCase().includes(keyword));
  }

  isResearchTask(description) {
    const keywords = ['research', 'investigate', 'study', 'compare', 'evaluate', 'literature'];
    return keywords.some(keyword => description.toLowerCase().includes(keyword));
  }

  // Plan creation methods for different task types
  createDataAnalysisPlan(description, options) {
    return [
      {
        name: 'Data Loading',
        tasks: [{
          description: 'Load and validate dataset',
          agentType: 'data-processor',
          estimatedTime: 10,
          requiredCapabilities: ['data_loading', 'data_validation']
        }]
      },
      {
        name: 'Data Analysis',
        tasks: [{
          description: 'Perform statistical analysis and generate insights',
          agentType: 'researcher',
          estimatedTime: 25,
          dependencies: ['task-1'],
          requiredCapabilities: ['statistical_analysis', 'data_exploration']
        }]
      }
    ];
  }

  createModelTrainingPlan(description, options) {
    return [
      {
        name: 'Data Preparation',
        tasks: [{
          description: 'Prepare training data',
          agentType: 'data-processor',
          estimatedTime: 15,
          requiredCapabilities: ['data_processing', 'feature_engineering']
        }]
      },
      {
        name: 'Model Training',
        tasks: [{
          description: 'Train machine learning model',
          agentType: 'model-trainer',
          estimatedTime: 45,
          dependencies: ['task-1'],
          requiredCapabilities: ['model_training', 'hyperparameter_tuning']
        }]
      }
    ];
  }

  createResearchPlan(description, options) {
    return [
      {
        name: 'Research',
        tasks: [{
          description: 'Conduct comprehensive research and analysis',
          agentType: 'researcher',
          estimatedTime: 30,
          requiredCapabilities: ['research', 'analysis', 'documentation']
        }]
      }
    ];
  }

  createGenericPlan(description, options) {
    return [
      {
        name: 'Execution',
        tasks: [{
          description: description,
          agentType: 'task-processor',
          estimatedTime: 20,
          requiredCapabilities: ['task_processing', 'general_analysis']
        }]
      }
    ];
  }

  // Utility methods
  calculateDependencyLevels(tasks) {
    // Simplified dependency level calculation
    const levels = [[]];
    const processed = new Set();
    
    for (const task of tasks) {
      if (!task.dependencies || task.dependencies.length === 0) {
        levels[0].push(task);
        processed.add(task.id);
      }
    }
    
    // Add remaining tasks to appropriate levels
    let levelIndex = 1;
    while (processed.size < tasks.length && levelIndex < 10) { // Prevent infinite loop
      levels[levelIndex] = [];
      
      for (const task of tasks) {
        if (!processed.has(task.id)) {
          const dependenciesMet = (task.dependencies || []).every(dep => processed.has(dep));
          if (dependenciesMet) {
            levels[levelIndex].push(task);
            processed.add(task.id);
          }
        }
      }
      
      levelIndex++;
    }
    
    return levels.filter(level => level.length > 0);
  }

  assessPlanComplexity(plan) {
    const taskCount = plan.tasks.length;
    const hasDependencies = plan.tasks.some(t => t.dependencies && t.dependencies.length > 0);
    const estimatedDuration = plan.estimatedDuration || 0;
    
    if (taskCount >= 5 || estimatedDuration >= 60 || hasDependencies) {
      return 'high';
    } else if (taskCount >= 3 || estimatedDuration >= 30) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  hasParallelizableTasks(plan) {
    return plan.tasks.length > 1 && plan.tasks.some(t => !t.dependencies || t.dependencies.length === 0);
  }

  inferRequiredCapabilities(task) {
    const capabilities = [];
    const description = task.description.toLowerCase();
    
    if (description.includes('data')) capabilities.push('data_processing');
    if (description.includes('analyze')) capabilities.push('analysis');
    if (description.includes('train')) capabilities.push('model_training');
    if (description.includes('research')) capabilities.push('research');
    
    return capabilities.length > 0 ? capabilities : ['task_processing'];
  }

  inferPreferredAgentTypes(task) {
    const description = task.description.toLowerCase();
    const types = [];
    
    if (description.includes('data')) types.push('data-processor');
    if (description.includes('model') || description.includes('train')) types.push('model-trainer');
    if (description.includes('research') || description.includes('analyze')) types.push('researcher');
    if (description.includes('plan')) types.push('planner');
    
    return types.length > 0 ? types : ['task-processor'];
  }

  parsePlanningResult(result) {
    // Parse structured planning result from planner agent
    try {
      if (typeof result === 'string') {
        // Try to extract YAML/JSON from the result
        const yamlMatch = result.match(/```yaml\n([\s\S]*?)\n```/) || result.match(/```yml\n([\s\S]*?)\n```/);
        const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/);
        
        if (yamlMatch) {
          // Would parse YAML in production
          return this.parseYamlPlan(yamlMatch[1]);
        } else if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
      }
      
      // Fallback: create simple plan
      return {
        objective: result.objective || 'Planned execution',
        phases: result.phases || [{ name: 'Execution', tasks: [{ description: 'Execute planned tasks' }] }],
        tasks: result.tasks || [],
        estimatedDuration: 30
      };
      
    } catch (error) {
      this.logger.warn('Failed to parse planning result, using fallback', { error: error.message });
      return {
        objective: 'Execution',
        phases: [{ name: 'Execution', tasks: [{ description: 'Execute tasks as planned' }] }],
        tasks: [{ id: 'fallback-task', description: 'Execute tasks as planned' }],
        estimatedDuration: 30
      };
    }
  }

  parseYamlPlan(yamlString) {
    // Simplified YAML parsing for plan structure
    // In production, use a proper YAML parser
    return {
      objective: 'Parsed plan execution',
      phases: [{ name: 'Execution', tasks: [{ description: 'Execute YAML-defined plan' }] }],
      tasks: [{ id: 'yaml-task', description: 'Execute YAML-defined plan' }],
      estimatedDuration: 25
    };
  }
}

module.exports = TaskOrchestrator;