import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import { ProjectConfig, SkuilderConfig } from '../types.js';
import { CourseConfig } from '@vue-skuilder/common';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find the standalone-ui template (embedded in CLI dist or from node_modules)
 */
export async function findStandaloneUiPath(): Promise<string> {
  // First try to find embedded template in CLI dist
  const embeddedTemplatePath = path.join(__dirname, '..', 'standalone-ui-template');
  if (existsSync(embeddedTemplatePath)) {
    return embeddedTemplatePath;
  }

  // Fallback: search for standalone-ui package in node_modules (for development)
  let currentDir = path.join(__dirname, '..', '..');
  while (currentDir !== path.dirname(currentDir)) {
    const nodeModulesPath = path.join(currentDir, 'node_modules', '@vue-skuilder', 'standalone-ui');
    if (existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error(
    'Could not find standalone-ui template. Please ensure @vue-skuilder/cli is properly built.'
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

  // Transform workspace and file dependencies to published versions
  if (packageJson.dependencies) {
    for (const [depName, version] of Object.entries(packageJson.dependencies)) {
      if (
        typeof version === 'string' &&
        (version.startsWith('workspace:') || version.startsWith('file:'))
      ) {
        // Replace workspace and file references with CLI's version
        packageJson.dependencies[depName] = `^${cliVersion}`;
      }
    }
  }

  // Add missing devDependencies for build system
  if (packageJson.devDependencies && !packageJson.devDependencies['terser']) {
    packageJson.devDependencies['terser'] = '^5.39.0';
  }
  if (packageJson.devDependencies && !packageJson.devDependencies['vite-plugin-dts']) {
    packageJson.devDependencies['vite-plugin-dts'] = '^4.3.0';
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
  // Create dual build config similar to standalone-ui but without workspace dependencies
  const transformedContent = `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';

// Determine build mode from environment variable
const buildMode = process.env.BUILD_MODE || 'webapp';

export default defineConfig({
  plugins: [
    vue(),
    // Only include dts plugin for library builds
    ...(buildMode === 'library'
      ? [dts({
          insertTypesEntry: true,
          include: ['src/questions/**/*.ts', 'src/questions/**/*.vue'],
          exclude: ['**/*.spec.ts', '**/*.test.ts'],
          outDir: 'dist-lib',
        })]
      : []
    )
  ],
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
      '@vue-skuilder/courseware',
    ],
  },
  // --- Dependencies optimization ---
  optimizeDeps: {
    include: [
      'events',
      '@vue-skuilder/common-ui',
      '@vue-skuilder/db',
      '@vue-skuilder/common',
      '@vue-skuilder/courseware',
    ],
  },
  server: {
    port: 5173, // Use standard Vite port for standalone projects
  },
  build: buildMode === 'library'
    ? {
        // Library build configuration
        sourcemap: true,
        target: 'es2020',
        minify: 'terser',
        terserOptions: {
          keep_classnames: true,
        },
        lib: {
          entry: resolve(__dirname, 'src/questions/index.ts'),
          name: 'VueSkuilderStandaloneQuestions',
          fileName: (format) => \`questions.\${format === 'es' ? 'mjs' : 'cjs.js'}\`,
        },
        rollupOptions: {
          // External packages that shouldn't be bundled in library mode
          external: [
            'vue',
            'vue-router',
            'vuetify',
            'pinia',
            '@vue-skuilder/common',
            '@vue-skuilder/common-ui',
            '@vue-skuilder/courseware',
            '@vue-skuilder/db',
          ],
          output: {
            // Global variables for UMD build
            globals: {
              'vue': 'Vue',
              'vue-router': 'VueRouter',
              'vuetify': 'Vuetify',
              'pinia': 'Pinia',
              '@vue-skuilder/common': 'VueSkuilderCommon',
              '@vue-skuilder/common-ui': 'VueSkuilderCommonUI',
              '@vue-skuilder/courseware': 'VueSkuilderCourseWare',
              '@vue-skuilder/db': 'VueSkuilderDB',
            },
            exports: 'named',
            // Preserve CSS in the output bundle
            assetFileNames: 'assets/[name].[ext]',
          },
        },
        // Output to separate directory for library build
        outDir: 'dist-lib',
        // Allow CSS code splitting for component libraries
        cssCodeSplit: true,
      }
    : {
        // Webapp build configuration (existing)
        sourcemap: true,
        target: 'es2020',
        minify: 'terser',
        terserOptions: {
          keep_classnames: true,
        },
        // Standard webapp output directory
        outDir: 'dist',
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
  config: ProjectConfig,
  outputPath?: string
): Promise<void> {
  const skuilderConfig: SkuilderConfig = {
    title: config.title,
    dataLayerType: config.dataLayerType,
  };

  // For dynamic data layer, use the specified course ID
  if (config.dataLayerType === 'couch' && config.course) {
    skuilderConfig.course = config.course;
  }

  // For static data layer, use imported course ID or generate new one
  if (config.dataLayerType === 'static') {
    if (config.importCourseIds && config.importCourseIds.length > 0) {
      skuilderConfig.course = config.importCourseIds[0];
    } else {
      // Generate UUID for new static courses without imports
      skuilderConfig.course = randomUUID();
    }
  }

  if (config.couchdbUrl) {
    skuilderConfig.couchdbUrl = config.couchdbUrl;
  }

  if (config.theme) {
    skuilderConfig.theme = config.theme;
  }

  await fs.writeFile(configPath, JSON.stringify(skuilderConfig, null, 2));

  // For static data layer without imports, create empty course structure
  if (
    config.dataLayerType === 'static' &&
    (!config.importCourseIds || config.importCourseIds.length === 0) &&
    outputPath
  ) {
    await createEmptyCourseStructure(outputPath, skuilderConfig.course!, config.title);
  }
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
 * Create empty course structure for new static courses
 */
async function createEmptyCourseStructure(
  projectPath: string,
  courseId: string,
  title: string
): Promise<void> {
  const staticCoursesPath = path.join(projectPath, 'public', 'static-courses');
  const coursePath = path.join(staticCoursesPath, courseId);

  // Create directory structure
  await fs.mkdir(coursePath, { recursive: true });
  await fs.mkdir(path.join(coursePath, 'chunks'), { recursive: true });
  await fs.mkdir(path.join(coursePath, 'indices'), { recursive: true });

  // Create minimal CourseConfig
  const courseConfig: CourseConfig = {
    courseID: courseId,
    name: title,
    description: '',
    public: false,
    deleted: false,
    creator: 'system',
    admins: [],
    moderators: [],
    dataShapes: [],
    questionTypes: [],
  };

  // Create manifest.json with proper structure
  const manifest = {
    version: '1.0.0',
    courseId,
    courseName: title,
    courseConfig,
    lastUpdated: new Date().toISOString(),
    documentCount: 0,
    chunks: [],
    indices: [],
    designDocs: [],
  };

  await fs.writeFile(path.join(coursePath, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Create empty tags index
  await fs.writeFile(
    path.join(coursePath, 'indices', 'tags.json'),
    JSON.stringify({ tags: [] }, null, 2)
  );

  // Create CourseConfig chunk
  await fs.writeFile(
    path.join(coursePath, 'chunks', 'CourseConfig.json'),
    JSON.stringify(
      [
        {
          _id: 'CourseConfig',
          ...courseConfig,
        },
      ],
      null,
      2
    )
  );

  console.log(chalk.green(`✅ Created empty course structure for ${courseId}`));
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
.skuilder/
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
\`\`\`${
    config.dataLayerType === 'static'
      ? `

## Studio Mode (Content Editing)

This project supports **Studio Mode** - a content editing web interface for modifying course data:

\`\`\`bash
npm run studio
\`\`\`

Studio mode provides:
- **Visual Course Editor**: Interactive interface for editing course content
- **Live Preview**: See changes immediately in the browser
- **Hot Reload**: Changes are saved automatically to your course files
- **No Setup Required**: Built into the Skuilder CLI - just run the command

When you run \`npm run studio\`, it will:
1. Start a local CouchDB instance for temporary editing
2. Load your course data from \`public/static-courses/\`
3. Launch the studio interface at http://localhost:7174
4. Provide MCP server connection for, eg, Claude Code integration
5. Save changes back to your static course files when you flush

**Important**: Studio mode **overwrites** existing static data source files in \`public/static-courses/\`. Make sure to commit or backup your course data before making major edits.

### Claude Code Integration (MCP Server)

Studio mode automatically provides an MCP (Model Context Protocol) server for AI-powered course authoring with Claude Code. When you run \`npm run studio\`, it displays connection details like:

\`\`\`bash
🔗 MCP Server: node ./node_modules/@vue-skuilder/cli/dist/mcp-server.js course-id 5985
📋 .mcp.json content:
{
  "mcpServers": {
    "vue-skuilder-studio": {
      "command": "./node_modules/@vue-skuilder/cli/dist/mcp-server.js",
      "args": ["course-id", "5985"],
      "env": {
        "COUCHDB_SERVER_URL": "localhost:5985",
        "COUCHDB_SERVER_PROTOCOL": "http",
        "COUCHDB_USERNAME": "admin",
        "COUCHDB_PASSWORD": "password"
      }
    }
  }
}
\`\`\`

Copy the generated \`.mcp.json\` content to your Claude Code configuration to enable:
- **AI Content Creation**: Generate course cards with fill-in-the-blank and multiple-choice questions
- **Smart Tagging**: Automatically tag cards and assign ELO difficulty ratings
- **Course Analysis**: Analyze existing course content and suggest improvements
- **Bulk Content Operations**: Create multiple cards at once with consistent formatting`
      : ''
  }

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
 * Create .skuilder directory structure for studio builds cache
 */
async function createSkuilderDirectory(projectPath: string): Promise<void> {
  const skuilderPath = path.join(projectPath, '.skuilder');
  const templatesPath = path.join(__dirname, '..', '..', 'templates', '.skuilder');

  // Create .skuilder directory
  await fs.mkdir(skuilderPath, { recursive: true });

  // Create studio-builds subdirectory
  await fs.mkdir(path.join(skuilderPath, 'studio-builds'), { recursive: true });

  // Copy README template if it exists
  if (existsSync(templatesPath)) {
    await copyDirectory(templatesPath, skuilderPath);
  } else {
    // Fallback: create basic README
    const readmeContent = `# .skuilder Directory

**⚠️ WARNING: GENERATED CONTENT - DO NOT EDIT MANUALLY ⚠️**

This directory contains files generated by the Skuilder CLI tools.

Generated by @vue-skuilder/cli
`;
    await fs.writeFile(path.join(skuilderPath, 'README.md'), readmeContent);
  }
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
  await generateSkuilderConfig(configPath, config, projectPath);

  console.log(chalk.blue('📝 Creating README...'));
  const readmePath = path.join(projectPath, 'README.md');
  await generateReadme(readmePath, config);

  console.log(chalk.blue('📄 Generating .gitignore...'));
  const gitignorePath = path.join(projectPath, '.gitignore');
  await generateGitignore(gitignorePath);

  console.log(chalk.blue('📁 Creating .skuilder directory structure...'));
  await createSkuilderDirectory(projectPath);

  console.log(chalk.green('✅ Template processing complete!'));
}
