// eslint-disable-next-line
const { exit } = require('process');
// eslint-disable-next-line
const { readdir, readFile, writeFile } = require('fs/promises');
// eslint-disable-next-line
const { join } = require('path');
// eslint-disable-next-line
const { execSync } = require('child_process');
// const { fetch } = require('node-fetch');

const conversionPrompt: string = `
System context:

# Task:

Please convert the following Vue 2 class-based component to an Options API based component.

# Context:

Part of a migration effort toward Vue 3.
The project is currently on
- Vue 2.7.16 - the latest available 2.x build, with migration features enabled.
- Typescript 5.7.2 - the current version.

# Requirements:

- Only modify the <script> section of the component
- Keep TypeScript support as far as possible. If type safety is removed, please note it.
- Prefer \`defineComponent()\` over \`Vue.extend()\`
- Preserve all existing functionality including base class features (if possible - else note it)
- Keep the same external component API (props, events, refs)
- Leave <template> and <style> sections unchanged
- Retain any blocks of commented-code that contain "system design" thoughts
- \`name\` the component according to the filename, unless there is some specific reason not to

Please provide:
1. The new <script> section, properly typed for TypeScript, enclosed in a <script><script/> tag and not in a code block.
2. A generic comment on the overall conversion process, in a <summary> section.
3. Any warnings about potential issues with base class functionality, in a <warnings> section. Be conservative - only include information that is likely to flag a problem. It is ok for this to be empty.


Here is the component to convert:

`;

const EXCLUDE_DIRS = ['node_modules', 'dist', 'tests', 'UserInput', 'courses'];
const SPECIFIC_PATH = ''; // optional: set to process specific subdirectory

async function* findVueFiles(dir: string): AsyncGenerator<string> {
  const files = await readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const path = join(dir, file.name);
    if (file.isDirectory() && !EXCLUDE_DIRS.includes(file.name)) {
      if (!SPECIFIC_PATH || path.includes(SPECIFIC_PATH)) {
        yield* findVueFiles(path);
      }
    } else if (file.name.endsWith('.vue')) {
      yield path;
    }
  }
}

async function checkoutOptionsBranch() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    const status = execSync('git status --porcelain').toString();

    if (status) {
      console.warn(
        'Warning: Working tree is not clean. Commit or stash changes before proceeding.'
      );
      exit();
    }

    // Create and switch to options-convert branch
    execSync('git checkout options-convert');
    console.log('Created and switched to branch: options-convert');
  } catch (error) {
    console.warn('Not a git repository or git error occurred:', JSON.stringify(error));
  }
}
let count = 0;
async function convertFile(filepath: string) {
  try {
    // Read and parse the Vue file
    const content = await readFile(filepath, 'utf-8');
    await checkoutOptionsBranch();

    // Check if file is class-based
    if (!content.includes('vue-class-component') && !content.includes('vue-property-decorator')) {
      console.log('Skipping conversion for', filepath, 'as it is not a class-based component');
      return;
    }

    count++;
    if (count > 10) {
      console.log(`Dry-run complete`);
      exit();
    }
    const filename = filepath.replace(/^.*[\\/]/, '').replace('.vue', '');
    const branchName = `convert-v3-${filename}`;

    // Check for git repository and clean working tree
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
      const status = execSync('git status --porcelain').toString();

      if (status) {
        console.warn(
          'Warning: Working tree is not clean. Commit or stash changes before proceeding.'
        );
        return;
      }

      // Create and switch to conversion branch
      execSync(`git checkout -b ${branchName}`);
      console.log(`Created and switched to branch: ${branchName}`);
    } catch (error) {
      console.warn('Not a git repository or git error occurred:', JSON.stringify(error));
      return;
    }

    // Make API call with your prompt
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: conversionPrompt + filepath + '\n\n```' + content + '```',
          },
        ],
      }),
    });

    if (!response.ok) {
      // throw new Error(`API request failed: ${response.statusText}`);
      console.error(`API request failed: ${response.statusText}`);

      checkoutOptionsBranch();
      return;
    }

    const result = await response.json();
    const aiResponse = result.content[0].text;

    // Validate response
    const scriptMatch = aiResponse.match(/<script.*?>([\s\S]*?)<\/script>/);
    if (!scriptMatch) {
      // throw new Error('No script section found in AI response');
      console.error(`No script section found in AI response for ${filepath}`);
      console.log(`Response: ${aiResponse}`);
      checkoutOptionsBranch();
      return;
    }

    const newScript = scriptMatch[1];

    // Get warnings from AI response
    const warningsMatch = aiResponse.match(/<warnings>([\s\S]*?)<\/warnings>/);
    const warnings = warningsMatch ? warningsMatch[1].trim() : '';

    if (warnings) {
      console.log('\nWarnings:', warnings);
    }

    // Get summary from AI response
    const summaryMatch = aiResponse.match(/<summary>([\s\S]*?)<\/summary>/);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    if (summary) {
      console.log('\nSummary:', summary);
    }

    console.log('\tResponse for', filepath, ':\n', aiResponse);

    await replaceScriptSection(filepath, newScript);
    console.log(`Converted ${filepath}`);

    try {
      const commitMessage = `refactor: convert ${filepath} from class-based to Options/Composition API

Summary:
${summary || '(none)'}

Warnings:
${warnings || '(none)'}`;

      execSync('git add .');
      execSync(`git commit -m "${commitMessage}"`);
      console.log(`Committed changes for ${filepath}`);

      execSync(`git push -u origin ${branchName}`);
      console.log(`Pushed branch for ${filepath}`);

      // Generate pull request
      execSync(`gh pr create --fill --base options-convert --head ${branchName}`);
      console.log(`Pull request created for ${filepath}`);

      checkoutOptionsBranch();
      console.log('Switched back to main branch');
    } catch (error) {
      console.error('Error in git operations:', error);
    }
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error);
  }
}

async function replaceScriptSection(filepath: string, newScript: string) {
  const content = await readFile(filepath, 'utf-8');
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/;
  const newContent = content.replace(scriptRegex, `<script lang="ts">${newScript}</script>`);
  await writeFile(filepath, newContent, 'utf-8');
}

async function main() {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Please provide an API key as an argument');
    process.exit(1);
  }
  process.env.ANTHROPIC_API_KEY = args[0];

  // Process all Vue files
  for await (const file of findVueFiles('./src')) {
    await convertFile(file);
  }
}

main().catch(console.error);
