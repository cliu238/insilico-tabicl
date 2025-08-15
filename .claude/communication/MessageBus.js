/**
 * MessageBus - Inter-agent communication system with priority queuing
 * Features reliable messaging, retry mechanisms, and performance monitoring
 */

const { v4: uuidv4 } = require('uuid');
const Logger = require('../core/Logger');

class MessageBus {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('MessageBus', { level: 'info' });
        
        this.queues = new Map(); // Agent-specific message queues
        this.subscribers = new Map(); // Event subscribers
        this.messageHistory = new Map(); // Message tracking
        
        this.metrics = {
            messagesSent: 0,
            messagesDelivered: 0,
            messagesFailed: 0,
            retriesAttempted: 0,
            averageDeliveryTime: 0
        };
        
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000; // ms
        this.maxQueueSize = config.maxQueueSize || 1000;
        
        this.logger.info('MessageBus initialized');
    }
    
    registerAgent(agentId, agentName) {
        this.queues.set(agentId, {
            messages: [],
            priority: [],
            name: agentName,
            deliveryStats: {
                received: 0,
                processed: 0,
                failed: 0
            }
        });
        
        this.logger.debug(`Registered agent: ${agentName} [${agentId}]`);
    }
    
    unregisterAgent(agentId) {
        this.queues.delete(agentId);
        this.subscribers.delete(agentId);
        this.logger.debug(`Unregistered agent: [${agentId}]`);
    }
    
    async sendMessage(fromAgentId, toAgentId, message, priority = 'normal', options = {}) {
        const messageId = uuidv4();
        const timestamp = Date.now();
        
        const messageObject = {
            id: messageId,
            from: fromAgentId,
            to: toAgentId,
            content: message,
            priority,
            timestamp,
            attempts: 0,
            maxRetries: options.maxRetries || this.maxRetries,
            ttl: options.ttl || 300000, // 5 minutes default
            requiresResponse: options.requiresResponse || false,
            correlationId: options.correlationId
        };
        
        this.metrics.messagesSent++;
        this.messageHistory.set(messageId, messageObject);
        
        try {
            await this.deliverMessage(messageObject);
            this.logger.debug(`Message sent: ${messageId} from ${fromAgentId} to ${toAgentId}`);
            return messageId;
        } catch (error) {
            this.logger.error(`Failed to send message ${messageId}:`, error);
            this.metrics.messagesFailed++;
            throw error;
        }
    }
    
    async deliverMessage(message) {
        const targetQueue = this.queues.get(message.to);
        
        if (!targetQueue) {
            throw new Error(`Target agent ${message.to} not registered`);
        }
        
        // Check queue size
        if (targetQueue.messages.length >= this.maxQueueSize) {
            throw new Error(`Queue full for agent ${message.to}`);
        }
        
        // Check TTL
        if (Date.now() - message.timestamp > message.ttl) {
            throw new Error(`Message ${message.id} expired`);
        }
        
        // Add to appropriate queue based on priority
        if (message.priority === 'high') {
            targetQueue.priority.unshift(message);
        } else {
            targetQueue.messages.push(message);
        }
        
        targetQueue.deliveryStats.received++;
        this.metrics.messagesDelivered++;
        
        // Calculate delivery time
        const deliveryTime = Date.now() - message.timestamp;
        this.updateAverageDeliveryTime(deliveryTime);
    }
    
    async broadcast(fromAgentId, message, priority = 'normal', options = {}) {
        const broadcastId = uuidv4();
        const promises = [];
        
        for (const [agentId, queue] of this.queues) {
            if (agentId !== fromAgentId) { // Don't send to self
                promises.push(
                    this.sendMessage(fromAgentId, agentId, message, priority, {
                        ...options,
                        correlationId: broadcastId
                    }).catch(error => {
                        this.logger.warn(`Failed to broadcast to ${agentId}:`, error);
                        return null;
                    })
                );
            }
        }
        
        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null);
        
        this.logger.debug(`Broadcast ${broadcastId}: ${successful.length}/${results.length} delivered`);
        return {
            broadcastId,
            totalAgents: results.length,
            successful: successful.length,
            messageIds: successful.map(r => r.value)
        };
    }
    
    async receiveMessages(agentId, maxMessages = 10) {
        const queue = this.queues.get(agentId);
        
        if (!queue) {
            throw new Error(`Agent ${agentId} not registered`);
        }
        
        const messages = [];
        
        // Process priority messages first
        while (queue.priority.length > 0 && messages.length < maxMessages) {
            const message = queue.priority.shift();
            if (this.isMessageValid(message)) {
                messages.push(message);
                queue.deliveryStats.processed++;
            }
        }
        
        // Process regular messages
        while (queue.messages.length > 0 && messages.length < maxMessages) {
            const message = queue.messages.shift();
            if (this.isMessageValid(message)) {
                messages.push(message);
                queue.deliveryStats.processed++;
            }
        }
        
        return messages;
    }
    
    isMessageValid(message) {
        // Check TTL
        if (Date.now() - message.timestamp > message.ttl) {
            this.logger.debug(`Message ${message.id} expired, discarding`);
            return false;
        }
        
        return true;
    }
    
    async retryMessage(messageId) {
        const message = this.messageHistory.get(messageId);
        
        if (!message) {
            throw new Error(`Message ${messageId} not found`);
        }
        
        if (message.attempts >= message.maxRetries) {
            throw new Error(`Message ${messageId} exceeded max retries`);
        }
        
        message.attempts++;
        this.metrics.retriesAttempted++;
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, message.attempts - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
            await this.deliverMessage(message);
            this.logger.debug(`Message ${messageId} retried successfully (attempt ${message.attempts})`);
        } catch (error) {
            this.logger.warn(`Retry ${message.attempts} failed for message ${messageId}:`, error);
            
            if (message.attempts >= message.maxRetries) {
                this.metrics.messagesFailed++;
                throw new Error(`Message ${messageId} failed after ${message.attempts} attempts`);
            }
        }
    }
    
    subscribe(agentId, eventType, callback) {
        if (!this.subscribers.has(agentId)) {
            this.subscribers.set(agentId, new Map());
        }
        
        const agentSubscriptions = this.subscribers.get(agentId);
        if (!agentSubscriptions.has(eventType)) {
            agentSubscriptions.set(eventType, []);
        }
        
        agentSubscriptions.get(eventType).push(callback);
        this.logger.debug(`Agent ${agentId} subscribed to ${eventType}`);
    }
    
    async publishEvent(fromAgentId, eventType, eventData) {
        const eventId = uuidv4();
        const eventMessage = {
            id: eventId,
            type: eventType,
            from: fromAgentId,
            data: eventData,
            timestamp: Date.now()
        };
        
        let notificationsSent = 0;
        
        for (const [agentId, subscriptions] of this.subscribers) {
            if (subscriptions.has(eventType)) {
                const callbacks = subscriptions.get(eventType);
                
                for (const callback of callbacks) {
                    try {
                        await callback(eventMessage);
                        notificationsSent++;
                    } catch (error) {
                        this.logger.error(`Event callback failed for agent ${agentId}:`, error);
                    }
                }
            }
        }
        
        this.logger.debug(`Event ${eventType} published: ${notificationsSent} notifications sent`);
        return {
            eventId,
            eventType,
            notificationsSent
        };
    }
    
    updateAverageDeliveryTime(deliveryTime) {
        const alpha = 0.1; // Exponential moving average smoothing factor
        if (this.metrics.averageDeliveryTime === 0) {
            this.metrics.averageDeliveryTime = deliveryTime;
        } else {
            this.metrics.averageDeliveryTime = 
                (alpha * deliveryTime) + ((1 - alpha) * this.metrics.averageDeliveryTime);
        }
    }
    
    getQueueStatus(agentId) {
        const queue = this.queues.get(agentId);
        
        if (!queue) {
            return null;
        }
        
        return {
            agentId,
            name: queue.name,
            regularMessages: queue.messages.length,
            priorityMessages: queue.priority.length,
            totalMessages: queue.messages.length + queue.priority.length,
            deliveryStats: queue.deliveryStats
        };
    }
    
    getAllQueueStatuses() {
        const statuses = {};
        
        for (const [agentId, queue] of this.queues) {
            statuses[agentId] = this.getQueueStatus(agentId);
        }
        
        return statuses;
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            activeQueues: this.queues.size,
            activeSubscribers: this.subscribers.size,
            totalQueuedMessages: Array.from(this.queues.values())
                .reduce((total, queue) => total + queue.messages.length + queue.priority.length, 0)
        };
    }
    
    async cleanup() {
        const now = Date.now();
        let cleanedMessages = 0;
        
        // Clean expired messages from queues
        for (const [agentId, queue] of this.queues) {
            queue.messages = queue.messages.filter(msg => {
                if (now - msg.timestamp > msg.ttl) {
                    cleanedMessages++;
                    return false;
                }
                return true;
            });
            
            queue.priority = queue.priority.filter(msg => {
                if (now - msg.timestamp > msg.ttl) {
                    cleanedMessages++;
                    return false;
                }
                return true;
            });
        }
        
        // Clean old message history (older than 1 hour)
        for (const [messageId, message] of this.messageHistory) {
            if (now - message.timestamp > 3600000) { // 1 hour
                this.messageHistory.delete(messageId);
                cleanedMessages++;
            }
        }
        
        if (cleanedMessages > 0) {
            this.logger.debug(`Cleaned up ${cleanedMessages} expired messages`);
        }
    }
    
    async shutdown() {
        // Final cleanup
        await this.cleanup();
        
        // Clear all queues
        this.queues.clear();
        this.subscribers.clear();
        this.messageHistory.clear();
        
        this.logger.info('MessageBus shutdown complete');
    }
}

module.exports = MessageBus;