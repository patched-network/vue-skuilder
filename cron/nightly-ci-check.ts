#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Configuration
const CONFIG = {
  CLAUDE_TIMEOUT: 300000, // 5 minutes in milliseconds for testing
  REPO_DIR: join(dirname(fileURLToPath(import.meta.url)), '..'),
  REPORTS_DIR: '',
  LOG_FILE: '',
  DATE_STAMP: new Date().toISOString().slice(0, 10).replace(/-/g, '')
};

// Initialize paths
CONFIG.REPORTS_DIR = join(CONFIG.REPO_DIR, 'cron', 'reports');
CONFIG.LOG_FILE = join(CONFIG.REPORTS_DIR, `nightly-ci-${CONFIG.DATE_STAMP}.log`);

// Types
interface WorkflowRun {
  databaseId: number;
  workflowName: string;
  conclusion: string | null;
  headSha: string;
  url: string;
  createdAt: string;
  event: string;
}

interface FailureInfo {
  runId: number;
  workflowName: string;
  headSha: string;
  url: string;
}

// Logging utility
function log(message: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const logLine = `[${timestamp}] ${message}`;
  
  // Write to log file
  try {
    writeFileSync(CONFIG.LOG_FILE, logLine + '\n', { flag: 'a' });
  } catch (err) {
    // If log file doesn't exist yet, create the directory and try again
    mkdirSync(CONFIG.REPORTS_DIR, { recursive: true });
    writeFileSync(CONFIG.LOG_FILE, logLine + '\n', { flag: 'a' });
  }
  
  // Also output to stderr for real-time feedback
  console.error(logLine);
}

// Execute shell command and return output
function execCommand(command: string, options: { cwd?: string; silent?: boolean } = {}): string {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      cwd: options.cwd || CONFIG.REPO_DIR,
      stdio: options.silent ? 'pipe' : ['inherit', 'pipe', 'inherit']
    });
    return result.trim();
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

// Clean workflow name for file/directory names
function cleanWorkflowName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Get scheduled workflow failures that haven't been superseded by recent successes
async function getScheduledFailures(): Promise<FailureInfo[]> {
  log("Checking for scheduled workflow failures...");
  
  // Get recent scheduled runs
  const runsJson = execCommand(
    'gh run list --limit 50 --json status,conclusion,workflowName,createdAt,headSha,url,event,databaseId',
    { silent: true }
  );
  
  const allRuns: WorkflowRun[] = JSON.parse(runsJson);
  const scheduledRuns = allRuns.filter(run => run.event === 'schedule');
  
  log(`DEBUG: Found ${scheduledRuns.length} scheduled runs`);
  
  // Group by workflow and find most recent run per workflow
  const workflowGroups = new Map<string, WorkflowRun[]>();
  scheduledRuns.forEach(run => {
    if (!workflowGroups.has(run.workflowName)) {
      workflowGroups.set(run.workflowName, []);
    }
    workflowGroups.get(run.workflowName)!.push(run);
  });
  
  const failures: FailureInfo[] = [];
  
  for (const [workflowName, runs] of workflowGroups) {
    // Sort by creation date (newest first)
    runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const mostRecent = runs[0];
    
    log(`DEBUG: Processing workflow: ${workflowName}`);
    log(`DEBUG: Latest run has conclusion: ${mostRecent.conclusion}`);
    
    if (mostRecent.conclusion === 'failure' || mostRecent.conclusion === 'cancelled') {
      log(`DEBUG: Adding ${workflowName} to failures list`);
      failures.push({
        runId: mostRecent.databaseId,
        workflowName: mostRecent.workflowName,
        headSha: mostRecent.headSha,
        url: mostRecent.url
      });
    }
  }
  
  log(`DEBUG: Final failures list has ${failures.length} entries`);
  
  if (failures.length === 0) {
    log("No unresolved scheduled workflow failures found");
    return [];
  }
  
  log(`Found ${failures.length} unresolved scheduled workflow failures`);
  return failures;
}

// Setup worktree for a specific failure
async function setupWorktreeForFailure(runId: number, workflowName: string): Promise<string> {
  const cleanWorkflow = cleanWorkflowName(workflowName);
  const worktreeName = `cc-resolve-${CONFIG.DATE_STAMP}-${cleanWorkflow}`;
  
  log(`Setting up worktree for ${workflowName} failure (run: ${runId})`);
  
  try {
    // Create worktree using git worktree command directly (force override if exists)
    const worktreePath = join('..', worktreeName);
    execCommand(`git worktree add -f "${worktreePath}"`, { silent: true });
    
    // Create reports directory in worktree
    mkdirSync(join(worktreePath, 'cron', 'reports'), { recursive: true });
    
    log(`Created worktree: ${worktreePath}`);
    return worktreePath;
  } catch (error: any) {
    log(`ERROR: Failed to create worktree ${worktreeName}: ${error.message}`);
    throw error;
  }
}

// Collect failure data for analysis
async function collectFailureData(
  runId: number,
  workflowName: string,
  headSha: string,
  runUrl: string,
  worktreePath: string
): Promise<void> {
  log(`Collecting failure data for ${workflowName} (run: ${runId})`);
  
  const cleanWorkflow = cleanWorkflowName(workflowName);
  const reportsDir = join(worktreePath, 'cron', 'reports');
  
  try {
    // Get failure logs
    log("Fetching failure logs...");
    const failureLogs = execCommand(`gh run view ${runId} --log`, { silent: true });
    writeFileSync(join(reportsDir, `failure-logs-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), failureLogs);
    
    // Get detailed run info
    const runDetails = execCommand(
      `gh run view ${runId} --json jobs,conclusion,workflowName,headSha,url,createdAt`,
      { silent: true }
    );
    writeFileSync(join(reportsDir, `failure-details-${cleanWorkflow}-${CONFIG.DATE_STAMP}.json`), runDetails);
    
    // Find last successful run of same workflow
    log(`Finding last successful run of ${workflowName}...`);
    try {
      const successfulRunsJson = execCommand(
        `gh run list --workflow="${workflowName}" --status=success --limit 1 --json status,conclusion,workflowName,createdAt,headSha,url,event,databaseId`,
        { silent: true }
      );
      
      const successfulRuns: WorkflowRun[] = JSON.parse(successfulRunsJson);
      const lastGoodRun = successfulRuns.find(run => run.event === 'schedule');
      
      if (lastGoodRun) {
        const goodSha = lastGoodRun.headSha;
        const goodRunId = lastGoodRun.databaseId;
        
        log(`Found last good run: ${goodRunId} (sha: ${goodSha})`);
        
        // Get commits between good and bad
        log(`Analyzing commits between ${goodSha} and ${headSha}...`);
        try {
          // Basic commit range
          const commitRange = execCommand(
            `git log --oneline --pretty=format:'%h|%s|%an|%ad' --date=short ${goodSha}..${headSha}`,
            { silent: true }
          );
          writeFileSync(join(reportsDir, `commit-range-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), commitRange);
          
          // Detailed git log with full messages
          const detailedLog = execCommand(
            `git log --pretty=format:'%H%n%an <%ae>%n%ad%n%s%n%n%b%n---COMMIT-END---' --date=iso ${goodSha}..${headSha}`,
            { silent: true }
          );
          writeFileSync(join(reportsDir, `detailed-commits-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), detailedLog);
          
          // Git diff summary (files changed)
          const diffStat = execCommand(
            `git diff --stat ${goodSha}..${headSha}`,
            { silent: true }
          );
          writeFileSync(join(reportsDir, `diff-stat-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), diffStat);
          
          // Git diff --name-status (files and change types)
          const nameStatus = execCommand(
            `git diff --name-status ${goodSha}..${headSha}`,
            { silent: true }
          );
          writeFileSync(join(reportsDir, `diff-name-status-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), nameStatus);
          
          // Full git diff (careful - this could be large)
          try {
            const fullDiff = execCommand(
              `git diff ${goodSha}..${headSha}`,
              { silent: true }
            );
            // Only write if diff is reasonable size (< 1MB)
            if (fullDiff.length < 1024 * 1024) {
              writeFileSync(join(reportsDir, `full-diff-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), fullDiff);
            } else {
              writeFileSync(join(reportsDir, `full-diff-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), 
                `Diff too large (${Math.round(fullDiff.length / 1024)}KB) - skipped for performance`);
            }
          } catch (diffError) {
            writeFileSync(join(reportsDir, `full-diff-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), "Could not generate full diff");
          }
          
        } catch (gitError) {
          log("Could not get commit range - continuing without it");
          writeFileSync(join(reportsDir, `commit-range-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), "No commit range available");
          writeFileSync(join(reportsDir, `detailed-commits-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), "No detailed commits available");
          writeFileSync(join(reportsDir, `diff-stat-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), "No diff stat available");
          writeFileSync(join(reportsDir, `diff-name-status-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), "No name status available");
          writeFileSync(join(reportsDir, `full-diff-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), "No full diff available");
        }
        
        // Get PR information for commits in range
        const prInfoFile = join(reportsDir, `pr-info-${cleanWorkflow}-${CONFIG.DATE_STAMP}.json`);
        try {
          const commits = execCommand(
            `git log --pretty=format:'%H' ${goodSha}..${headSha}`,
            { silent: true }
          ).split('\n').filter(sha => sha.trim());
          
          const prInfo = [];
          for (const commitSha of commits) {
            try {
              const prData = execCommand(
                `gh pr list --search "${commitSha}" --json number,title,author,mergedAt,url --limit 1`,
                { silent: true }
              );
              const prs = JSON.parse(prData);
              if (prs.length > 0) {
                prInfo.push({
                  commit: commitSha,
                  pr: prs[0]
                });
              }
            } catch (prError) {
              // Skip if can't find PR for this commit
              continue;
            }
          }
          writeFileSync(prInfoFile, JSON.stringify(prInfo, null, 2));
        } catch (prError) {
          writeFileSync(prInfoFile, '[]');
        }
        
        writeFileSync(join(reportsDir, `last-good-run-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), `${goodSha}|${goodRunId}`);
      } else {
        log(`WARNING: No successful scheduled run found for ${workflowName}`);
        writeFileSync(join(reportsDir, `last-good-run-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), "No successful run found");
      }
    } catch (error) {
      log(`WARNING: Could not find successful runs for ${workflowName}`);
      writeFileSync(join(reportsDir, `last-good-run-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt`), "No successful run found");
    }
    
    // Create metadata file
    const metadata = {
      runId,
      workflowName,
      headSha,
      runUrl,
      analysisDate: new Date().toISOString(),
      worktreePath
    };
    writeFileSync(join(reportsDir, `metadata-${cleanWorkflow}-${CONFIG.DATE_STAMP}.json`), JSON.stringify(metadata, null, 2));
    
    log(`Data collection completed for ${workflowName}`);
  } catch (error: any) {
    log(`ERROR: Failed to collect data for ${workflowName}: ${error.message}`);
    throw error;
  }
}

// Invoke Claude analysis in worktree
async function invokeClaudeAnalysis(workflowName: string, worktreePath: string): Promise<boolean> {
  const cleanWorkflow = cleanWorkflowName(workflowName);
  log(`Invoking Claude analysis for ${workflowName} in ${worktreePath}`);
  
  const claudePrompt = `# Automated CI Failure Analysis

You are analyzing a CI failure in a dedicated worktree. The failure data has been pre-collected in ./cron/reports/.

Your task is to:
1. **Analyze the failure** using the pre-collected data:
   - Read failure-logs-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt for error details
   - Read failure-details-${cleanWorkflow}-${CONFIG.DATE_STAMP}.json for run metadata
   - Read commit-range-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt for basic commit list
   - Read detailed-commits-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt for full commit messages
   - Read diff-stat-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt for file change summary
   - Read diff-name-status-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt for specific file changes
   - Read full-diff-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt for complete code changes
   - Read pr-info-${cleanWorkflow}-${CONFIG.DATE_STAMP}.json for PR context
   - Read last-good-run-${cleanWorkflow}-${CONFIG.DATE_STAMP}.txt for baseline reference

2. **Perform root cause analysis** and assess fix confidence (0-100%):
   - **High confidence (80-100%)**: Simple dependency updates, lint fixes, obvious typos
   - **Medium confidence (60-79%)**: Test failures with clear fixes, build config issues
   - **Low confidence (0-59%)**: Complex logic errors, environmental issues

3. **Create analysis report** in ./cron/reports/:
   - **Always create**: assessment-${cleanWorkflow}-${CONFIG.DATE_STAMP}.md
   - **If attempting fix**: resolution-${cleanWorkflow}-${CONFIG.DATE_STAMP}.md
   - **If deferring**: status-${cleanWorkflow}-${CONFIG.DATE_STAMP}.md

4. **If confidence >75%**: Implement fix, test, and commit with clear message

**Important**: Work only with the pre-collected data. Focus on analysis and solution, not data gathering.

Begin analysis now.`;

  try {
    // Write prompt to file for debugging
    writeFileSync(join(worktreePath, 'claude-prompt.txt'), claudePrompt);
    log(`DEBUG: Wrote Claude prompt to ${join(worktreePath, 'claude-prompt.txt')}`);
    
    // Use Claude in print mode (-p) which is better for programmatic usage
    const claude = spawn('claude', ['-p', claudePrompt], {
      cwd: worktreePath,
      stdio: 'pipe',
      env: process.env  // Pass full environment including auth configs
    });
    
    let claudeOutput = '';
    let claudeError = '';
    
    claude.stdout.on('data', (data) => {
      const chunk = data.toString();
      claudeOutput += chunk;
      log(`DEBUG: Claude stdout chunk: ${chunk.slice(0, 200)}...`);
    });
    
    claude.stderr.on('data', (data) => {
      const chunk = data.toString();
      claudeError += chunk;
      log(`DEBUG: Claude stderr chunk: ${chunk.slice(0, 200)}...`);
    });
    
    // Wait for Claude to complete with timeout
    const result = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        claude.kill();
        reject(new Error('Claude analysis timed out'));
      }, CONFIG.CLAUDE_TIMEOUT);
      
      claude.on('close', (code) => {
        clearTimeout(timeout);
        resolve(code || 0);
      });
      
      claude.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    if (result === 0) {
      log(`Claude analysis completed successfully for ${workflowName}`);
      return true;
    } else {
      log(`ERROR: Claude analysis failed for ${workflowName} with exit code ${result}`);
      if (claudeError) {
        log(`Claude stderr: ${claudeError}`);
      }
      if (claudeOutput) {
        log(`Claude stdout: ${claudeOutput}`);
      }
      return false;
    }
  } catch (error: any) {
    if (error.message.includes('timed out')) {
      log(`WARNING: Claude analysis timed out for ${workflowName} after ${CONFIG.CLAUDE_TIMEOUT / 1000}s`);
    } else {
      log(`ERROR: Claude analysis failed for ${workflowName}: ${error.message}`);
    }
    return false;
  }
}

// Main execution
async function main(): Promise<void> {
  log(`Starting nightly CI check for ${CONFIG.REPO_DIR}`);
  
  try {
    // Ensure we're in a git repository
    execCommand('git rev-parse --is-inside-work-tree', { silent: true });
  } catch (error) {
    log("ERROR: Not in a git repository. Exiting.");
    process.exit(1);
  }
  
  // Check if required commands are available
  const requiredCommands = ['gh', 'claude'];
  for (const cmd of requiredCommands) {
    try {
      execCommand(`command -v ${cmd}`, { silent: true });
    } catch (error) {
      log(`ERROR: ${cmd} command not found. Please ensure it's available in PATH.`);
      process.exit(1);
    }
  }
  
  // Check if git worktree is available
  try {
    execCommand('git worktree --help', { silent: true });
  } catch (error) {
    log("ERROR: git worktree not available. Please ensure you have Git 2.5+.");
    process.exit(1);
  }
  
  log("Starting automated CI analysis...");
  
  try {
    // Get scheduled workflow failures
    const failures = await getScheduledFailures();
    
    if (failures.length === 0) {
      log("No scheduled workflow failures to process. Exiting.");
      return;
    }
    
    let failureCount = 0;
    let successCount = 0;
    
    // Process each failure
    for (const failure of failures) {
      failureCount++;
      log(`Processing failure ${failureCount}: ${failure.workflowName} (run: ${failure.runId})`);
      
      try {
        // Setup worktree for this failure
        const worktreePath = await setupWorktreeForFailure(failure.runId, failure.workflowName);
        
        // Collect failure data
        await collectFailureData(
          failure.runId,
          failure.workflowName,
          failure.headSha,
          failure.url,
          worktreePath
        );
        
        // Invoke Claude analysis
        const success = await invokeClaudeAnalysis(failure.workflowName, worktreePath);
        if (success) {
          successCount++;
          log(`Successfully completed analysis for ${failure.workflowName}`);
        } else {
          log(`ERROR: Analysis failed for ${failure.workflowName}`);
        }
      } catch (error: any) {
        log(`ERROR: Failed to process ${failure.workflowName}: ${error.message}`);
      }
    }
    
    log(`Nightly CI check completed. Processed ${failureCount} failures, ${successCount} successful analyses.`);
    log(`See full log at: ${CONFIG.LOG_FILE}`);
  } catch (error: any) {
    log(`ERROR: Main execution failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}