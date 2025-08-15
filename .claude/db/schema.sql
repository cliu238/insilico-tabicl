-- Multi-Agent Swarm Database Schema
-- Stores swarm state, agent information, tasks, and collaboration data

-- Swarms table - Top-level swarm instances
CREATE TABLE IF NOT EXISTS swarms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    objective TEXT,
    topology TEXT DEFAULT 'hierarchical' CHECK (topology IN ('hierarchical', 'mesh', 'ring', 'star')),
    status TEXT DEFAULT 'active' CHECK (status IN ('initializing', 'active', 'paused', 'terminated', 'error')),
    max_agents INTEGER DEFAULT 8,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agents table - Individual agents within swarms
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    capabilities TEXT, -- JSON array of capabilities
    status TEXT DEFAULT 'idle' CHECK (status IN ('initializing', 'idle', 'working', 'error', 'terminated')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('lowest', 'low', 'medium', 'high', 'highest')),
    role TEXT DEFAULT 'specialist' CHECK (role IN ('coordinator', 'specialist', 'queen')),
    max_concurrent_tasks INTEGER DEFAULT 1,
    tasks_completed INTEGER DEFAULT 0,
    working_time INTEGER DEFAULT 0, -- Total working time in milliseconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table - Individual tasks and their execution state
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    parent_task_id TEXT REFERENCES tasks(id), -- For subtasks
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    assigned_agent_id TEXT REFERENCES agents(id),
    dependencies TEXT, -- JSON array of task IDs
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    estimated_duration INTEGER, -- Estimated duration in minutes
    actual_duration INTEGER, -- Actual duration in minutes
    result TEXT, -- JSON result data
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME
);

-- Collective memory table - Distributed memory system
CREATE TABLE IF NOT EXISTS collective_memory (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    namespace TEXT NOT NULL DEFAULT 'default',
    key TEXT NOT NULL,
    value TEXT NOT NULL, -- JSON data
    metadata TEXT, -- JSON metadata
    ttl INTEGER, -- Time to live in seconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    UNIQUE(swarm_id, namespace, key)
);

-- Agent communications table - Message passing between agents
CREATE TABLE IF NOT EXISTS agent_communications (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    from_agent_id TEXT REFERENCES agents(id),
    to_agent_id TEXT REFERENCES agents(id), -- NULL for broadcast messages
    message_type TEXT NOT NULL,
    content TEXT NOT NULL, -- JSON message content
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
    retry_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME
);

-- Task contexts table - Enhanced task execution context
CREATE TABLE IF NOT EXISTS task_contexts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    context_data TEXT, -- JSON context data
    shared_data TEXT, -- JSON shared data between agents
    collaboration_state TEXT, -- JSON collaboration tracking
    checkpoints TEXT, -- JSON checkpoint data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent performance metrics table
CREATE TABLE IF NOT EXISTS agent_metrics (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON additional context
);

-- Swarm events table - Audit log of important swarm events
CREATE TABLE IF NOT EXISTS swarm_events (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data TEXT, -- JSON event details
    agent_id TEXT REFERENCES agents(id),
    task_id TEXT REFERENCES tasks(id),
    severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Checkpoints table - Task and swarm state checkpoints
CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id),
    checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('task', 'swarm', 'agent')),
    state_data TEXT NOT NULL, -- JSON state snapshot
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_agents_swarm_id ON agents(swarm_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);

CREATE INDEX IF NOT EXISTS idx_tasks_swarm_id ON tasks(swarm_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent_id ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_memory_swarm_namespace ON collective_memory(swarm_id, namespace);
CREATE INDEX IF NOT EXISTS idx_memory_key ON collective_memory(key);
CREATE INDEX IF NOT EXISTS idx_memory_expires_at ON collective_memory(expires_at);

CREATE INDEX IF NOT EXISTS idx_communications_swarm_id ON agent_communications(swarm_id);
CREATE INDEX IF NOT EXISTS idx_communications_from_agent ON agent_communications(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_communications_to_agent ON agent_communications(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_communications_status ON agent_communications(status);

CREATE INDEX IF NOT EXISTS idx_task_contexts_task_id ON task_contexts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_contexts_swarm_id ON task_contexts(swarm_id);

CREATE INDEX IF NOT EXISTS idx_metrics_agent_id ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded_at ON agent_metrics(recorded_at);

CREATE INDEX IF NOT EXISTS idx_events_swarm_id ON swarm_events(swarm_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON swarm_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON swarm_events(created_at);

CREATE INDEX IF NOT EXISTS idx_checkpoints_swarm_id ON checkpoints(swarm_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_task_id ON checkpoints(task_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_type ON checkpoints(checkpoint_type);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_swarms_timestamp 
    AFTER UPDATE ON swarms
    BEGIN
        UPDATE swarms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_agents_last_active 
    AFTER UPDATE ON agents
    BEGIN
        UPDATE agents SET last_active = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_task_contexts_timestamp 
    AFTER UPDATE ON task_contexts
    BEGIN
        UPDATE task_contexts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS active_swarms AS
SELECT * FROM swarms WHERE status = 'active';

CREATE VIEW IF NOT EXISTS active_agents AS
SELECT a.*, s.name as swarm_name 
FROM agents a 
JOIN swarms s ON a.swarm_id = s.id 
WHERE a.status IN ('idle', 'working') AND s.status = 'active';

CREATE VIEW IF NOT EXISTS running_tasks AS
SELECT t.*, a.name as agent_name, s.name as swarm_name
FROM tasks t
LEFT JOIN agents a ON t.assigned_agent_id = a.id
JOIN swarms s ON t.swarm_id = s.id
WHERE t.status IN ('assigned', 'running');

CREATE VIEW IF NOT EXISTS agent_performance AS
SELECT 
    a.id,
    a.name,
    a.type,
    a.tasks_completed,
    a.working_time,
    CASE 
        WHEN a.working_time > 0 THEN a.tasks_completed * 3600000.0 / a.working_time 
        ELSE 0 
    END as tasks_per_hour,
    (julianday('now') - julianday(a.created_at)) * 24 * 3600 * 1000 as total_uptime,
    CASE 
        WHEN (julianday('now') - julianday(a.created_at)) * 24 * 3600 * 1000 > 0 
        THEN a.working_time * 100.0 / ((julianday('now') - julianday(a.created_at)) * 24 * 3600 * 1000)
        ELSE 0 
    END as utilization_percentage
FROM agents a
WHERE a.status != 'terminated';

CREATE VIEW IF NOT EXISTS swarm_health AS
SELECT 
    s.id,
    s.name,
    s.status,
    s.topology,
    COUNT(DISTINCT a.id) as total_agents,
    COUNT(DISTINCT CASE WHEN a.status IN ('idle', 'working') THEN a.id END) as active_agents,
    COUNT(DISTINCT CASE WHEN t.status = 'running' THEN t.id END) as running_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
    s.created_at,
    s.updated_at
FROM swarms s
LEFT JOIN agents a ON s.id = a.swarm_id
LEFT JOIN tasks t ON s.id = t.swarm_id
GROUP BY s.id, s.name, s.status, s.topology, s.created_at, s.updated_at;