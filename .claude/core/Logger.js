/**
 * Logger - Centralized logging system with structured output
 * Supports multiple log levels and output formats
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor(name, options = {}) {
        this.name = name;
        this.level = options.level || 'info';
        this.colors = options.colors !== false;
        this.writeToFile = options.writeToFile !== false;
        this.logDir = options.logDir || '.claude/logs';
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.colors = {
            error: '\x1b[31m',  // Red
            warn: '\x1b[33m',   // Yellow
            info: '\x1b[36m',   // Cyan
            debug: '\x1b[35m',  // Magenta
            reset: '\x1b[0m'
        };
        
        if (this.writeToFile) {
            this.ensureLogDirectory();
        }
    }
    
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ') : '';
        
        return `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}${formattedArgs}`;
    }
    
    shouldLog(level) {
        return this.levels[level] <= this.levels[this.level];
    }
    
    log(level, message, ...args) {
        if (!this.shouldLog(level)) {
            return;
        }
        
        const formattedMessage = this.formatMessage(level, message, ...args);
        
        // Console output with colors
        if (this.colors) {
            const colorCode = this.colors[level] || '';
            const resetCode = this.colors.reset;
            console.log(`${colorCode}${formattedMessage}${resetCode}`);
        } else {
            console.log(formattedMessage);
        }
        
        // File output
        if (this.writeToFile) {
            const logFile = path.join(this.logDir, `${this.name.toLowerCase()}.log`);
            fs.appendFileSync(logFile, formattedMessage + '\n');
        }
    }
    
    error(message, ...args) {
        this.log('error', message, ...args);
    }
    
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    
    info(message, ...args) {
        this.log('info', message, ...args);
    }
    
    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
    
    createChild(childName) {
        return new Logger(`${this.name}:${childName}`, {
            level: this.level,
            colors: this.colors,
            writeToFile: this.writeToFile,
            logDir: this.logDir
        });
    }
}

module.exports = Logger;