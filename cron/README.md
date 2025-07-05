# Cron Automation Scripts

This directory contains dev-local cron automation scripts for agentic quality control and CI/CD monitoring.

## Purpose

These scripts enable automated, AI-driven quality control by:
- Monitoring CI/CD pipeline health
- Performing automated root cause analysis of failures
- Attempting autonomous fixes for high-confidence issues
- Generating detailed reports for manual review

## Scripts

### `nightly-ci-check.sh`

**Purpose**: Automated nightly CI health check and fix attempt

**Schedule**: Runs at 2:00 AM daily via cron

**Workflow**:
1. Checks recent GitHub workflow runs using `gh` CLI
2. For each failed workflow, creates a dedicated worktree using `nt` command
3. Performs root cause analysis using Claude Code
4. Always creates `assessment-<workflow>-YYYYMMDD.md` with analysis
5. For high-confidence fixes (>75%), attempts fix and creates `resolution-<workflow>-YYYYMMDD.md`
6. For deferred fixes, creates `status-<workflow>-YYYYMMDD.md` with reasoning

**Dependencies**:
- GitHub CLI (`gh`) - for workflow and log access
- Claude Code CLI (`claude`) - for AI analysis and fixes
- Local `nt` command - for worktree management (defined in `~/.colin.bashrc`)

## Setup

### 1. Install Dependencies

```bash
# Install GitHub CLI
sudo apt install gh  # or equivalent for your OS

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Authenticate with GitHub
gh auth login
```

### 2. Configure Cron Job

Add to your crontab (`crontab -e`):

```cron
# Nightly CI health check at 2:00 AM
0 2 * * * /path/to/your/repo/cron/nightly-ci-check.sh
```

### 3. Directory Structure

```
cron/
├── README.md              # This file
├── nightly-ci-check.sh    # Main automation script
└── reports/               # Analysis reports and logs
    ├── nightly-ci-YYYYMMDD.log          # Execution logs
    ├── assessment-<workflow>-YYYYMMDD.md # Always created
    ├── resolution-<workflow>-YYYYMMDD.md # If fix attempted
    └── status-<workflow>-YYYYMMDD.md     # If fix deferred
```

## Configuration

Edit `nightly-ci-check.sh` to customize:
- `CLAUDE_TIMEOUT`: Max time for Claude operations (default: 1 hour)
- Log retention policies
- Confidence thresholds for auto-fixes
- Notification preferences

## Security Considerations

- Scripts run with your local user permissions
- GitHub access uses your authenticated `gh` CLI session
- Claude Code uses your API configuration
- All operations are logged for audit purposes
- Fix branches are created locally and not automatically pushed

## Monitoring

Check logs in `cron/reports/` for:
- Execution status and timing
- CI analysis results
- Fix attempts and outcomes
- Error conditions and debugging info

## Troubleshooting

**Common Issues**:
- `gh` authentication expired: Run `gh auth login`
- `claude` not found: Ensure Claude Code is installed and in PATH
- Permission denied: Ensure script is executable (`chmod +x`)
- Timeout issues: Increase `CLAUDE_TIMEOUT` value

**Debug Mode**:
Run script manually to test:
```bash
cd /path/to/repo
./cron/nightly-ci-check.sh
```

## Philosophy

This automation follows the principle of "assisted autonomy":
- High-confidence, low-risk fixes are automated
- Complex or risky issues generate detailed analysis for human review
- All actions are logged and auditable
- Conservative approach prioritizes safety over speed

The goal is to handle routine CI failures automatically while escalating complex issues to human developers with comprehensive analysis.