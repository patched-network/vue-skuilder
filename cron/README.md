# Cron Automation Scripts

This directory contains dev-local cron automation scripts for agentic quality control and CI/CD monitoring.

## Scripts

### `nightly-ci-check.ts`

**Purpose**: Automated nightly CI health check and fix attempt

**Requirements**: 
- Node.js with `tsx` for TypeScript execution
- GitHub CLI (`gh`) authenticated
- Claude Code CLI (`claude`) 
- Git 2.5+ with worktree support

**Schedule**: Runs at 2:00 AM daily via cron

**Workflow**:
1. Checks recent GitHub workflow runs using GitHub CLI
2. Filters for scheduled workflows with unresolved failures/cancellations
3. For each failure, creates a dedicated worktree using `nt` command
4. Collects failure data: logs, metadata, commit ranges, PR information
5. Invokes Claude Code for root cause analysis in isolated worktree
6. Generates assessment reports and attempts fixes based on confidence level

### Configure Cron Job

Add to your crontab (`crontab -e`):

```cron
# Nightly CI health check at 2:00 AM
0 2 * * * cd /path/to/your/repo && npx tsx cron/nightly-ci-check.ts
```

### Manual Testing

```bash
cd /path/to/your/repo
npx tsx cron/nightly-ci-check.ts
```