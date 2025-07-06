# Cron Automation Scripts

This directory contains dev-local cron automation scripts for agentic quality control and CI/CD monitoring.

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

### Configure Cron Job

Add to your crontab (`crontab -e`):

```cron
# Nightly CI health check at 2:00 AM
0 2 * * * /path/to/your/repo/cron/nightly-ci-check.sh
```
