#!/bin/bash

# Multi-Agent Swarm Orchestrator
# Simplified interface for common swarm operations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(dirname "$SCRIPT_DIR")"
CLI_PATH="$CLAUDE_DIR/core/cli.js"

# Logging function
log() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Node.js is installed
check_dependencies() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js >= 14.0.0"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2)
    local major_version=$(echo $node_version | cut -d'.' -f1)
    
    if [ "$major_version" -lt 14 ]; then
        error "Node.js version $node_version is too old. Please install Node.js >= 14.0.0"
        exit 1
    fi
    
    if [ ! -f "$CLI_PATH" ]; then
        error "CLI not found at $CLI_PATH"
        exit 1
    fi
}

# Initialize swarm
swarm_init() {
    local topology=${1:-"hierarchical"}
    local max_agents=${2:-"8"}
    local project_type=${3:-"data-science"}
    
    log "🚀 Initializing swarm with $topology topology (max $max_agents agents)"
    
    if node "$CLI_PATH" init "$topology" "$max_agents" "$project_type"; then
        success "Swarm initialized successfully"
    else
        error "Failed to initialize swarm"
        exit 1
    fi
}

# Spawn an agent
spawn_agent() {
    local agent_type=$1
    local agent_name=${2:-""}
    
    if [ -z "$agent_type" ]; then
        error "Agent type is required"
        echo "Usage: $0 spawn <type> [name]"
        exit 1
    fi
    
    log "🤖 Spawning $agent_type agent"
    
    if [ -n "$agent_name" ]; then
        node "$CLI_PATH" spawn "$agent_type" "$agent_name"
    else
        node "$CLI_PATH" spawn "$agent_type"
    fi
}

# Batch spawn default agents
batch_spawn() {
    log "🚀 Spawning default agent set"
    
    if node "$CLI_PATH" batch-spawn; then
        success "Default agents spawned successfully"
    else
        error "Failed to spawn default agents"
        exit 1
    fi
}

# Orchestrate a task
orchestrate_task() {
    local task_description=$1
    local strategy=${2:-"adaptive"}
    local priority=${3:-"medium"}
    
    if [ -z "$task_description" ]; then
        error "Task description is required"
        echo "Usage: $0 orchestrate <task_description> [strategy] [priority]"
        exit 1
    fi
    
    log "📋 Orchestrating task: $task_description"
    log "🎯 Strategy: $strategy, Priority: $priority"
    
    if node "$CLI_PATH" orchestrate "$task_description" "$strategy" "$priority" --show-result; then
        success "Task orchestration completed"
    else
        error "Task orchestration failed"
        exit 1
    fi
}

# Show swarm status
swarm_status() {
    local detailed=${1:-"false"}
    
    log "📊 Getting swarm status"
    
    if [ "$detailed" = "true" ] || [ "$detailed" = "--detailed" ]; then
        node "$CLI_PATH" status --detailed
    else
        node "$CLI_PATH" status
    fi
}

# List agents
list_agents() {
    local detailed=${1:-"false"}
    
    log "🤖 Listing agents"
    
    if [ "$detailed" = "true" ] || [ "$detailed" = "--detailed" ]; then
        node "$CLI_PATH" list-agents --detailed
    else
        node "$CLI_PATH" list-agents
    fi
}

# Cleanup resources
cleanup() {
    log "🧹 Cleaning up resources"
    
    if node "$CLI_PATH" cleanup; then
        success "Cleanup completed"
    else
        warning "Cleanup encountered issues"
    fi
}

# Shutdown swarm
shutdown() {
    log "🛑 Shutting down swarm"
    
    if node "$CLI_PATH" shutdown; then
        success "Swarm shutdown completed"
    else
        warning "Shutdown encountered issues"
    fi
}

# Run quick demo
demo() {
    log "🎬 Running swarm demonstration"
    
    echo
    log "Step 1: Initialize swarm"
    swarm_init "hierarchical" "6" "data-science"
    
    echo
    log "Step 2: Spawn agents"
    batch_spawn
    
    echo
    log "Step 3: Check status"
    swarm_status "true"
    
    echo
    log "Step 4: Orchestrate sample task"
    orchestrate_task "Analyze sample dataset and generate insights" "adaptive" "medium"
    
    echo
    log "Step 5: Final status check"
    swarm_status "true"
    
    echo
    log "Step 6: Cleanup"
    cleanup
    
    success "Demo completed successfully!"
}

# Setup database and dependencies
setup() {
    log "🔧 Setting up multi-agent orchestration system"
    
    # Check dependencies
    check_dependencies
    
    # Setup database
    log "Setting up database"
    if node "$CLAUDE_DIR/db/db-setup.js" init; then
        success "Database setup completed"
    else
        error "Database setup failed"
        exit 1
    fi
    
    # Verify installation
    log "Verifying installation"
    if node "$CLAUDE_DIR/db/db-setup.js" verify; then
        success "Installation verified"
    else
        error "Installation verification failed"
        exit 1
    fi
    
    success "Setup completed successfully!"
    echo
    echo "Next steps:"
    echo "  $0 init                    # Initialize a swarm"
    echo "  $0 spawn-all              # Spawn default agents"
    echo "  $0 status --detailed      # Check swarm status"
    echo "  $0 demo                   # Run complete demo"
}

# Show help
show_help() {
    echo "Multi-Agent Swarm Orchestrator"
    echo
    echo "Usage: $0 <command> [options]"
    echo
    echo "Commands:"
    echo "  setup                               Setup database and verify installation"
    echo "  init [topology] [max_agents]       Initialize swarm (default: hierarchical 8)"
    echo "  spawn <type> [name]                 Spawn specific agent"
    echo "  spawn-all                           Spawn default agent set"
    echo "  orchestrate <task> [strategy] [priority]  Orchestrate task execution"
    echo "  status [--detailed]                 Show swarm status"
    echo "  list-agents [--detailed]            List all agents"
    echo "  cleanup                             Clean up resources"
    echo "  shutdown                            Shutdown swarm"
    echo "  demo                                Run complete demonstration"
    echo
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 init hierarchical 8"
    echo "  $0 spawn data-processor data-proc-1"
    echo "  $0 spawn-all"
    echo "  $0 orchestrate 'Analyze PHMRC dataset' parallel high"
    echo "  $0 status --detailed"
    echo "  $0 demo"
    echo
    echo "Topologies: hierarchical, mesh, ring, star"
    echo "Strategies: adaptive, sequential, parallel, hierarchical"
    echo "Priorities: low, medium, high"
}

# Main command dispatcher
main() {
    # Check dependencies first
    check_dependencies
    
    case "$1" in
        "setup")
            setup
            ;;
        "init")
            swarm_init "$2" "$3" "$4"
            ;;
        "spawn")
            spawn_agent "$2" "$3"
            ;;
        "spawn-all")
            batch_spawn
            ;;
        "orchestrate")
            orchestrate_task "$2" "$3" "$4"
            ;;
        "status")
            swarm_status "$2"
            ;;
        "list-agents")
            list_agents "$2"
            ;;
        "cleanup")
            cleanup
            ;;
        "shutdown")
            shutdown
            ;;
        "demo")
            demo
            ;;
        "help"|"--help"|"-h"|"")
            show_help
            ;;
        *)
            error "Unknown command: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"