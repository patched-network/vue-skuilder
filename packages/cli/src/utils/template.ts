import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { ProjectConfig, SkuilderConfig } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find the standalone-ui package in node_modules
 */
export async function findStandaloneUiPath(): Promise<string> {
  // Start from CLI package root and work upward
  let currentDir = path.join(__dirname, '..', '..');
  
  while (currentDir !== path.dirname(currentDir)) {
    const nodeModulesPath = path.join(currentDir, 'node_modules', '@vue-skuilder', 'standalone-ui');
    if (existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }
    currentDir = path.dirname(currentDir);
  }
  
  throw new Error('Could not find @vue-skuilder/standalone-ui package. Please ensure it is installed.');
}

/**
 * Copy directory recursively, excluding certain files/directories
 */
export async function copyDirectory(
  source: string,
  destination: string,
  excludePatterns: string[] = ['node_modules', 'dist', '.git', 'cypress']
): Promise<void> {
  const entries = await fs.readdir(source, { withFileTypes: true });
  
  await fs.mkdir(destination, { recursive: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    // Skip excluded patterns
    if (excludePatterns.some(pattern => entry.name.includes(pattern))) {
      continue;
    }
    
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath, excludePatterns);
    } else {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

/**
 * Transform package.json to use published dependencies instead of workspace references
 */
export async function transformPackageJson(
  packageJsonPath: string,
  projectName: string,
  cliVersion: string
): Promise<void> {
  const content = await fs.readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);
  
  // Update basic project info
  packageJson.name = projectName;
  packageJson.description = `Skuilder course application: ${projectName}`;
  packageJson.version = '1.0.0';
  
  // Transform workspace dependencies to published versions
  if (packageJson.dependencies) {
    for (const [depName, version] of Object.entries(packageJson.dependencies)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        // Replace workspace references with CLI's version
        packageJson.dependencies[depName] = `^${cliVersion}`;
      }
    }
  }
  
  // Remove CLI-specific fields that don't belong in generated projects
  delete packageJson.publishConfig;
  
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

/**
 * Generate skuilder.config.json based on project configuration
 */
export async function generateSkuilderConfig(
  configPath: string,
  config: ProjectConfig
): Promise<void> {
  const skuilderConfig: SkuilderConfig = {
    title: config.title,
    dataLayerType: config.dataLayerType
  };
  
  if (config.course) {
    skuilderConfig.course = config.course;
  }
  
  if (config.couchdbUrl) {
    skuilderConfig.couchdbUrl = config.couchdbUrl;
  }
  
  if (config.theme) {
    skuilderConfig.theme = config.theme;
  }
  
  await fs.writeFile(configPath, JSON.stringify(skuilderConfig, null, 2));
}

/**
 * Generate project README.md
 */
export async function generateReadme(
  readmePath: string,
  config: ProjectConfig
): Promise<void> {
  const dataLayerInfo = config.dataLayerType === 'static' 
    ? 'This project uses a static data layer with JSON files.'
    : `This project connects to CouchDB at: ${config.couchdbUrl || '[URL not specified]'}`;
    
  const readme = `# ${config.title}

A Skuilder course application built with Vue 3, Vuetify, and Pinia.

## Data Layer

${dataLayerInfo}

## Development

Install dependencies:
\`\`\`bash
npm install
\`\`\`

Start the development server:
\`\`\`bash
npm run dev
\`\`\`

Build for production:
\`\`\`bash
npm run build
\`\`\`

## Configuration

Course configuration is managed in \`skuilder.config.json\`. You can modify:
- Course title
- Data layer settings
- Theme customization
- Database connection details (for dynamic data layer)

## Theme

Current theme: **${config.theme.name}**
- Primary: ${config.theme.colors.primary}
- Secondary: ${config.theme.colors.secondary}  
- Accent: ${config.theme.colors.accent}

## Testing

Run end-to-end tests:
\`\`\`bash
npm run test:e2e
\`\`\`

Run tests in headless mode:
\`\`\`bash
npm run test:e2e:headless
\`\`\`

## Learn More

Visit the [Skuilder documentation](https://github.com/NiloCK/vue-skuilder) for more information about building course applications.
`;

  await fs.writeFile(readmePath, readme);
}

/**
 * Copy and transform the standalone-ui template to create a new project
 */
export async function processTemplate(
  projectPath: string,
  config: ProjectConfig,
  cliVersion: string
): Promise<void> {
  console.log(chalk.blue('📦 Locating standalone-ui template...'));
  const templatePath = await findStandaloneUiPath();
  
  console.log(chalk.blue('📂 Copying project files...'));
  await copyDirectory(templatePath, projectPath);
  
  console.log(chalk.blue('⚙️  Configuring package.json...'));
  const packageJsonPath = path.join(projectPath, 'package.json');
  await transformPackageJson(packageJsonPath, config.projectName, cliVersion);
  
  console.log(chalk.blue('🔧 Generating configuration...'));
  const configPath = path.join(projectPath, 'skuilder.config.json');
  await generateSkuilderConfig(configPath, config);
  
  console.log(chalk.blue('📝 Creating README...'));
  const readmePath = path.join(projectPath, 'README.md');
  await generateReadme(readmePath, config);
  
  console.log(chalk.green('✅ Template processing complete!'));
}