#!/bin/bash

# Nightly CI Check Script for Claude Code Automation
# This script runs at 2 AM daily to check for CI failures and attempt automated fixes

set -euo pipefail

# Configuration
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="$REPO_DIR/cron/reports"
LOG_FILE="$REPORT_DIR/nightly-ci-$(date +%Y%m%d).log"
CLAUDE_TIMEOUT=3600  # 1 hour timeout for Claude operations

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
cleanup() {
    log "Script interrupted or completed. Cleaning up..."
    # Add any cleanup operations here
}
trap cleanup EXIT

# Main execution
main() {
    log "Starting nightly CI check for $(pwd)"
    
    # Change to repo directory
    cd "$REPO_DIR"
    
    # Ensure we're in a git repository
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        log "ERROR: Not in a git repository. Exiting."
        exit 1
    fi
    
    # Check if gh CLI is available
    if ! command -v gh >/dev/null 2>&1; then
        log "ERROR: GitHub CLI (gh) not found. Please install it first."
        exit 1
    fi
    
    # Check if claude is available
    if ! command -v claude >/dev/null 2>&1; then
        log "ERROR: Claude Code CLI not found. Please install it first."
        exit 1
    fi
    
    log "Starting automated CI analysis with Claude Code..."
    
    # Run Claude Code with comprehensive CI analysis prompt
    timeout "$CLAUDE_TIMEOUT" claude --non-interactive <<'EOF'
# Nightly CI Analysis and Auto-Fix Task

You are running an automated nightly CI health check. Your task is to:

1. **Analyze CI Status**: Use `gh` to check recent workflow runs and identify failures
2. **Per-Failure Processing**: For EACH failed workflow, create a separate worktree and analysis:
   - Use `nt cc-resolve-$(date +%Y%m%d)-<workflow-name>` for each failure
   - Find the last known-good run of the same workflow
   - Pull logs and perform root cause analysis
   - List PRs/commits between good and bad runs
   - Assess likelihood of successful autonomous fix (0-100%)

## Analysis Framework

### Step 1: Get CI Status
```bash
gh run list --limit 20 --json status,conclusion,workflowName,createdAt,headSha,url
```

### Step 2: For Each Failure (Separate Worktrees)
```bash
# Create dedicated worktree for this failure
nt cc-resolve-$(date +%Y%m%d)-<workflow-name>
cd ../cc-resolve-$(date +%Y%m%d)-<workflow-name>

# Get detailed run info
gh run view <run-id> --json jobs,conclusion,workflowName,headSha,url
gh run view <run-id> --log
gh run list --workflow=<workflow-name> --status=success --limit 1
```

### Step 3: Root Cause Analysis
Analyze:
- Error messages in logs
- Changed files between good/bad commits
- Common failure patterns (deps, tests, build, lint)
- Environmental factors

### Step 4: Fix Assessment & Documentation
Rate confidence (0-100%) based on:
- **High confidence (80-100%)**: Simple dependency updates, known lint fixes, obvious typos
- **Medium confidence (60-79%)**: Test failures with clear fixes, build config issues
- **Low confidence (0-59%)**: Complex logic errors, environmental issues, unclear failures

### Step 5: Create Reports (in each worktree)
For each failure, create in `cron/reports/`:

**Always create**: `assessment-<workflow-name>-$(date +%Y%m%d).md`
- Failure summary and root cause analysis
- Commit/PR range analysis
- Fix confidence assessment

**If fix attempted**: `resolution-<workflow-name>-$(date +%Y%m%d).md`
- Fix implementation details
- Test results and verification
- Success/failure status

**If fix deferred**: `status-<workflow-name>-$(date +%Y%m%d).md`
- Reasons for deferral
- Manual intervention required
- Next steps recommendation

### Step 6: Auto-Fix Execution (if confidence >75%)
1. Implement fix in the dedicated worktree
2. Run relevant tests to verify
3. Commit with descriptive message
4. Document in resolution.md

## Important Notes
- Each failure gets its own worktree for isolation
- Always create assessment.md, plus resolution.md OR status.md
- Conservative approach: when in doubt, defer to manual review
- Use proper git hygiene and descriptive commits

Begin analysis now.
EOF
    
    local claude_exit_code=$?
    
    if [ $claude_exit_code -eq 0 ]; then
        log "Claude Code analysis completed successfully"
    elif [ $claude_exit_code -eq 124 ]; then
        log "WARNING: Claude Code analysis timed out after ${CLAUDE_TIMEOUT}s"
    else
        log "ERROR: Claude Code analysis failed with exit code $claude_exit_code"
    fi
    
    log "Nightly CI check completed. See full log at: $LOG_FILE"
}

# Run main function
main "$@"