# Create PRP

## Feature file for task ID: $ARGUMENTS

Generate a complete PRP from @TASK.md for general feature implementation with thorough research. Ensure context is passed to the AI agent to enable self-validation and iterative refinement. Read the feature file first to understand what needs to be created, how the examples provided help, and any other considerations.

The AI agent only gets the context you are appending to the PRP and training data. Assume the AI agent has access to the codebase and the same knowledge cutoff as you, so its important that your research findings are included or referenced in the PRP. The Agent has Websearch capabilities, so pass urls to documentation and examples.

## Research Process

1. **Project Understanding**
   - Read PLANNING.md to understand the overall project architecture, goals, and vision
   - Understand how features interconnect and the big picture strategy
   - Identify key architectural decisions and constraints

2. **Task Analysis**
   - Read TASK.md to understand the specific assigned task
   - Review completed tasks to see what has been implemented
   - Identify what still needs to be done and any dependencies
   - Understand the task's priority and relationship to other tasks

3. **Codebase Analysis**
   - Search for similar features/patterns in the codebase
   - Identify files to reference in PRP
   - Note existing conventions to follow
   - Check test patterns for validation approach

4. **User Clarification** (if needed)
   - Specific patterns to mirror and where to find them?
   - Integration requirements and where to find them?
   - Any ambiguities in the task requirements?

5. **External Research** (as needed)
   - Search for similar features/patterns online
   - Library documentation (include specific URLs)
   - Implementation examples (GitHub/StackOverflow/blogs)
   - Best practices and common pitfalls

## PRP Generation

Using PRPs/templates/prp_base.md as template:

### Critical Context to Include and pass to the AI agent as part of the PRP

- **Patterns**: Existing approaches to follow
- **Subagents**: Check all available agents in .claude/agents/ directory (except expert-orchestrator)
  - Identify which specialized agents will be needed for the task
  - List them in the PRP's "Subagents Involved" section
  - Specify their roles and responsibilities
- **Documentation**: URLs with specific sections
- **Code Examples**: Real snippets from codebase
- **Gotchas**: Library quirks, version issues
### Implementation Blueprint
- Start with pseudocode showing approach
- Reference real files for patterns
- Include error handling strategy
- list tasks to be completed to fullfill the PRP in the order they should be completed

### Validation Gates (Must be Executable) eg for python
```bash
# Syntax/Style
ruff check --fix && mypy .

# Unit Tests
poetry run pytest tests/ -v

```

*** CRITICAL AFTER YOU ARE DONE RESEARCHING AND EXPLORING THE CODEBASE BEFORE YOU START WRITING THE PRP ***

*** ULTRATHINK ABOUT THE PRP AND PLAN YOUR APPROACH THEN START WRITING THE PRP ***

## Output
1. Save PRP as: `PRPs/{task-id}_{feature-name}.md`
   Example: `PRPs/TASK-001_baseline_benchmark.md`

2. Update task status in TASK.md to in-process:
   - Find the task ID in TASK.md
   - Change `[ ]` to `[~]` to indicate work has started
   - Example: `- [~] **[TASK-001]** Load and inspect PHMRC child dataset`

3. Create GitHub Issue for tracking:
   ```bash
   gh issue create \
     --title "[{task-id}] {feature-name}" \
     --body "Task ID: {task-id}\nPRP: PRPs/{task-id}_{feature-name}.md\n\n## Description\n{brief description from PRP}\n\n## Success Criteria\n{list from PRP}" \
     --label "task"
   ```

## Quality Checklist
- [ ] All necessary context included
- [ ] Validation gates are executable by AI
- [ ] References existing patterns
- [ ] Clear implementation path
- [ ] Error handling documented

Score the PRP on a scale of 1-10 (confidence level to succeed in one-pass implementation using claude codes)

Remember: The goal is one-pass implementation success through comprehensive context.