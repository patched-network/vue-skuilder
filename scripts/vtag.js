#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// All packages that need version updates
const PACKAGES = [
  'common',
  'db',
  'common-ui',
  'courseware',
  'edit-ui',
  'client',
  'platform-ui',
  'standalone-ui',
  'express',
  'mcp',
  'cli',
];

function main() {
  const tagString = process.argv[2];

  if (!tagString) {
    console.error('Usage: node vtag.js <version-string>');
    console.error('Example: node vtag.js 0.1.8-3');
    process.exit(1);
  }

  console.log(`🏷️  Setting all packages to version: ${tagString}`);

  // Update all package.json versions
  for (const packageName of PACKAGES) {
    const packagePath = path.join(__dirname, '..', 'packages', packageName);
    const packageJsonPath = path.join(packagePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      console.error(`❌ Package not found: ${packagePath}`);
      continue;
    }

    try {
      // Read package.json
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Update version
      const oldVersion = packageJson.version;
      packageJson.version = tagString;

      // Write back to file
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

      console.log(`✅ ${packageName}: ${oldVersion} → ${tagString}`);
    } catch (error) {
      console.error(`❌ Failed to update ${packageName}: ${error.message}`);
    }
  }

  console.log(`\n📦 Updating yarn lockfile...`);
  
  // Run yarn to update lockfile
  const yarnProcess = spawn('yarn', ['install'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  yarnProcess.on('close', (yarnCode) => {
    if (yarnCode !== 0) {
      console.error(`❌ Yarn install failed with exit code ${yarnCode}`);
      process.exit(1);
    }

    console.log(`✅ Yarn lockfile updated`);
    console.log(`\n📝 Committing changes...`);

    // Commit the changes
    const commitProcess = spawn('git', ['commit', '-am', `bump: version ${tagString}`], {
      stdio: 'inherit', 
      cwd: path.join(__dirname, '..')
    });

    commitProcess.on('close', (commitCode) => {
      if (commitCode !== 0) {
        console.error(`❌ Git commit failed with exit code ${commitCode}`);
        process.exit(1);
      }

      console.log(`✅ Changes committed`);
      console.log(`\n🏷️  Creating git tag: v${tagString}`);

      // Create git tag
      const gitProcess = spawn('git', ['tag', `v${tagString}`], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Git tag v${tagString} created successfully`);
          console.log(`\nNext steps:`);
          console.log(`  git push origin v${tagString}  # Push tag to trigger release`);
        } else {
          console.error(`❌ Git tag creation failed with exit code ${code}`);
          process.exit(1);
        }
      });

      gitProcess.on('error', (error) => {
        console.error(`❌ Failed to create git tag: ${error.message}`);
        process.exit(1);
      });
    });

    commitProcess.on('error', (error) => {
      console.error(`❌ Failed to commit changes: ${error.message}`);
      process.exit(1);
    });
  });

  yarnProcess.on('error', (error) => {
    console.error(`❌ Failed to run yarn install: ${error.message}`);
    process.exit(1);
  });
}

main();
