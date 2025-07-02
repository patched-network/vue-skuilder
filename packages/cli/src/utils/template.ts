import { promises as fs, existsSync } from 'fs';
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

  throw new Error(
    'Could not find @vue-skuilder/standalone-ui package. Please ensure it is installed.'
  );
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
    if (excludePatterns.some((pattern) => entry.name.includes(pattern))) {
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
  cliVersion: string,
  config: ProjectConfig
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

  // Add missing terser devDependency for build minification
  if (packageJson.devDependencies && !packageJson.devDependencies['terser']) {
    packageJson.devDependencies['terser'] = '^5.39.0';
  }

  // Add CLI as devDependency for all projects
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  packageJson.devDependencies['@vue-skuilder/cli'] = `^${cliVersion}`;

  // Add studio script for static data layer projects
  if (config.dataLayerType === 'static') {
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    packageJson.scripts['studio'] = 'skuilder studio';
  }

  // Remove CLI-specific fields that don't belong in generated projects
  delete packageJson.publishConfig;

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

/**
 * Create a vite.config.ts to work with published packages instead of workspace sources
 *
 * // [ ] This should be revised so that it works from the existing vite.config.ts in standalone-ui. As is, it recreates 95% of the same config.
 */
export async function createViteConfig(viteConfigPath: string): Promise<void> {
  // Create a clean vite config for standalone projects
  const transformedContent = `// packages/standalone-ui/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Alias for internal src paths
      '@': fileURLToPath(new URL('./src', import.meta.url)),

      // Add events alias if needed (often required by dependencies)
      events: 'events',
    },
    extensions: ['.js', '.ts', '.json', '.vue'],
    dedupe: [
      // Ensure single instances of core libs and published packages
      'vue',
      'vuetify',
      'pinia',
      'vue-router',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/common-ui',
      '@vue-skuilder/courses',
    ],
  },
  // --- Dependencies optimization ---
  optimizeDeps: {
    // Help Vite pre-bundle dependencies from published packages
    include: [
      '@vue-skuilder/common-ui',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/courses',
    ],
  },
  server: {
    port: 5173, // Use standard Vite port for standalone projects
  },
  build: {
    sourcemap: true,
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      keep_classnames: true,
    },
  },
  // Add define block for process polyfills
  define: {
    global: 'window',
    'process.env': process.env,
    'process.browser': true,
    'process.version': JSON.stringify(process.version),
  },
});
`;

  await fs.writeFile(viteConfigPath, transformedContent);
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
    dataLayerType: config.dataLayerType,
  };

  // For dynamic data layer, use the specified course ID
  if (config.dataLayerType === 'couch' && config.course) {
    skuilderConfig.course = config.course;
  }

  // For static data layer with imported courses, use the first course as primary
  if (
    config.dataLayerType === 'static' &&
    config.importCourseIds &&
    config.importCourseIds.length > 0
  ) {
    skuilderConfig.course = config.importCourseIds[0];
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
 * Transform tsconfig.json to be standalone (remove base config reference)
 */
export async function transformTsConfig(tsconfigPath: string): Promise<void> {
  const content = await fs.readFile(tsconfigPath, 'utf-8');
  const tsconfig = JSON.parse(content);

  // Remove the extends reference to the monorepo base config
  delete tsconfig.extends;

  // Merge in the essential settings from the base config that scaffolded apps need
  tsconfig.compilerOptions = {
    ...tsconfig.compilerOptions,
    // Essential TypeScript settings from base config
    strict: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    // Keep existing Vue/Vite-specific settings
    target: tsconfig.compilerOptions.target || 'ESNext',
    useDefineForClassFields: tsconfig.compilerOptions.useDefineForClassFields,
    module: tsconfig.compilerOptions.module || 'ESNext',
    moduleResolution: tsconfig.compilerOptions.moduleResolution || 'bundler',
    jsx: tsconfig.compilerOptions.jsx || 'preserve',
    resolveJsonModule: tsconfig.compilerOptions.resolveJsonModule,
    isolatedModules: tsconfig.compilerOptions.isolatedModules,
    lib: tsconfig.compilerOptions.lib || ['ESNext', 'DOM'],
    noEmit: tsconfig.compilerOptions.noEmit,
    baseUrl: tsconfig.compilerOptions.baseUrl || '.',
    types: tsconfig.compilerOptions.types || ['vite/client'],
  };

  await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
}

/**
 * Generate .gitignore file for the project
 */
export async function generateGitignore(gitignorePath: string): Promise<void> {
  const gitignoreContent = `# Dependencies
node_modules/
/.pnp
.pnp.js

# Production builds
/dist
/build

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Log files
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt
dist

# Gatsby files
.cache/
public

# Storybook build outputs
.out
.storybook-out

# Temporary folders
tmp/
temp/

# Editor directories and files
.vscode/
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS generated files
Thumbs.db

# Cypress
/cypress/videos/
/cypress/screenshots/

# Local development
.env.development
.env.production

# Package manager lockfiles (uncomment if you want to ignore them)
# package-lock.json
# yarn.lock
# pnpm-lock.yaml

# Skuilder specific
/src/data/local-*.json
`;

  await fs.writeFile(gitignorePath, gitignoreContent);
}

/**
 * Generate project README.md
 */
export async function generateReadme(readmePath: string, config: ProjectConfig): Promise<void> {
  let dataLayerInfo = '';

  if (config.dataLayerType === 'static') {
    dataLayerInfo = 'This project uses a static data layer with JSON files.';

    if (config.importCourseIds && config.importCourseIds.length > 0) {
      const courseList = config.importCourseIds.map((id) => `- ${id}`).join('\n');
      dataLayerInfo += `\n\n**Imported Courses:**\n${courseList}\n\nCourse data is stored in \`public/static-courses/\` and loaded automatically.`;
    }
  } else {
    dataLayerInfo = `This project connects to CouchDB at: ${config.couchdbUrl || '[URL not specified]'}`;
  }

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

Current theme: **${config.theme.name}** (${config.theme.defaultMode} mode)
- Primary: ${config.theme.light.colors.primary}
- Secondary: ${config.theme.light.colors.secondary}
- Accent: ${config.theme.light.colors.accent}

This theme includes both light and dark variants. The application will use the ${config.theme.defaultMode} theme by default, but users can toggle between light and dark modes in their settings.

### Theme Customization

To customize the theme colors, edit the \`theme\` section in \`skuilder.config.json\`:

\`\`\`json
{
  "theme": {
    "name": "custom",
    "defaultMode": "light",
    "light": {
      "dark": false,
      "colors": {
        "primary": "#your-color",
        "secondary": "#your-color",
        "accent": "#your-color"
        // ... other semantic colors
      }
    },
    "dark": {
      "dark": true,
      "colors": {
        // ... dark variant colors
      }
    }
  }
}
\`\`\`

The theme system supports all Vuetify semantic colors including error, success, warning, info, background, surface, and text colors. Changes to the configuration file are applied automatically on restart.

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
  await transformPackageJson(packageJsonPath, config.projectName, cliVersion, config);

  console.log(chalk.blue('🔧 Creating vite.config.ts...'));
  const viteConfigPath = path.join(projectPath, 'vite.config.ts');
  if (existsSync(viteConfigPath)) {
    await createViteConfig(viteConfigPath);
  }

  console.log(chalk.blue('🔧 Transforming tsconfig.json...'));
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    await transformTsConfig(tsconfigPath);
  }

  console.log(chalk.blue('🔧 Generating configuration...'));
  const configPath = path.join(projectPath, 'skuilder.config.json');
  await generateSkuilderConfig(configPath, config);

  console.log(chalk.blue('📝 Creating README...'));
  const readmePath = path.join(projectPath, 'README.md');
  await generateReadme(readmePath, config);

  console.log(chalk.blue('📄 Generating .gitignore...'));
  const gitignorePath = path.join(projectPath, '.gitignore');
  await generateGitignore(gitignorePath);

  console.log(chalk.green('✅ Template processing complete!'));
}
