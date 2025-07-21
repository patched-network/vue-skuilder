# Plan: Intégrer le serveur MCP dans Studio Mode

## Vue d'ensemble

Permettre aux clients MCP (comme Claude Code) de se connecter au cours en cours d'édition dans le mode studio en exposant un exécutable MCP que le client peut lancer.

## Architecture Choisie

**Bundle MCP Executable** : Le CLI intègre un serveur MCP standalone que les clients MCP peuvent exécuter directement via stdio.

```
Studio Mode Lance:
├── CouchDB (Docker)
├── Express Backend  
├── Studio-UI Web
└── Info MCP → 🔗 MCP Server: node dist/mcp-server.mjs <course-id>
                  (Client MCP lance ce processus)
```

## Phase 1: Infrastructure de Base

### 1.1 Créer l'Exécutable MCP Standalone
**Fichier** : `packages/cli/src/mcp-server.ts`
```typescript
#!/usr/bin/env node
import { initializeDataLayer, getDataLayer } from '@vue-skuilder/db';
import { MCPServer } from '@vue-skuilder/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  const courseId = process.argv[2];
  if (!courseId) {
    console.error('Usage: node mcp-server.mjs <course-id>');
    process.exit(1);
  }
  
  // Configuration CouchDB depuis variables d'environnement
  const couchdbConfig = {
    type: 'couch',
    options: {
      COUCHDB_SERVER_URL: process.env.COUCHDB_SERVER_URL || 'localhost:5984',
      COUCHDB_SERVER_PROTOCOL: process.env.COUCHDB_SERVER_PROTOCOL || 'http',
      COUCHDB_USERNAME: process.env.COUCHDB_USERNAME || 'admin',
      COUCHDB_PASSWORD: process.env.COUCHDB_PASSWORD || 'password'
    }
  };
  
  await initializeDataLayer(couchdbConfig);
  const dataLayer = getDataLayer();
  await dataLayer.initialize();
  
  const courseDB = dataLayer.getCourseDB(courseId);
  const server = new MCPServer(courseDB);
  const transport = new StdioServerTransport();
  
  console.error(`MCP Server started for course: ${courseId}`);
  await server.start(transport);
}

main().catch((error) => {
  console.error('MCP Server failed:', error);
  process.exit(1);
});
```

### 1.2 Modifier le Build du CLI
**Fichier** : `packages/cli/package.json` (scripts)
```json
{
  "scripts": {
    "build": "tsc && npm run build:copy-mcp",
    "build:copy-mcp": "cp src/mcp-server.ts dist/mcp-server.mjs"
  }
}
```

**Ou mieux** : Inclure dans la compilation TypeScript pour avoir les bonnes imports.

### 1.3 Ajouter MCP aux Dépendances CLI
**Fichier** : `packages/cli/package.json`
```json
{
  "dependencies": {
    "@vue-skuilder/mcp": "workspace:*",
    // ... existing deps
  }
}
```

## Phase 2: Intégration Studio

### 2.1 Modifier studio.ts pour Exposer les Infos MCP
**Fonction** : `launchStudio()` dans `packages/cli/src/commands/studio.ts`

```typescript
// Après le démarrage réussi de tous les services
console.log(chalk.green(`✅ Studio session ready!`));
console.log(chalk.white(`🎨 Studio URL: http://localhost:${studioUIPort}`));
console.log(chalk.gray(`   Database: ${studioDatabaseName} on port ${options.port}`));
console.log(chalk.gray(`   Express API: ${expressManager.getConnectionDetails().url}`));

// NOUVEAU: Info de connexion MCP
const mcpServerPath = path.join(__dirname, 'mcp-server.mjs');
const mcpCommand = `node ${mcpServerPath} ${unpackResult.courseId}`;
console.log(chalk.blue(`🔗 MCP Server: ${mcpCommand}`));
console.log(chalk.gray(`   Connect MCP clients using the command above`));

// Variables d'environnement pour le serveur MCP
const couchDetails = couchDBManager.getConnectionDetails();
console.log(chalk.gray(`   MCP Environment:`));
console.log(chalk.gray(`     COUCHDB_SERVER_URL=${couchDetails.url.replace('http://', '')}`));
console.log(chalk.gray(`     COUCHDB_USERNAME=${couchDetails.username}`));
console.log(chalk.gray(`     COUCHDB_PASSWORD=${couchDetails.password}`));
```

### 2.2 Helper pour Configuration MCP
**Nouvelle fonction** dans `studio.ts`:
```typescript
function getMCPConnectionInfo(
  unpackResult: UnpackResult, 
  couchDBManager: CouchDBManager
): { command: string; env: Record<string, string> } {
  const mcpServerPath = path.join(__dirname, 'mcp-server.mjs');
  const couchDetails = couchDBManager.getConnectionDetails();
  
  return {
    command: `node ${mcpServerPath} ${unpackResult.courseId}`,
    env: {
      COUCHDB_SERVER_URL: couchDetails.url.replace(/^https?:\/\//, ''),
      COUCHDB_SERVER_PROTOCOL: couchDetails.url.startsWith('https') ? 'https' : 'http',
      COUCHDB_USERNAME: couchDetails.username,
      COUCHDB_PASSWORD: couchDetails.password
    }
  };
}
```

## Phase 3: Testing et Validation

### 3.1 Test Manual avec MCP Inspector
```bash
# Terminal 1: Lancer studio
yarn workspace @vue-skuilder/cli build
skuilder studio

# Terminal 2: Tester le serveur MCP
cd packages/cli/dist
COUCHDB_SERVER_URL=localhost:5985 \
COUCHDB_USERNAME=admin \
COUCHDB_PASSWORD=password \
npx @modelcontextprotocol/inspector node mcp-server.mjs <course-id>
```

### 3.2 Test avec Claude Code
1. Lancer studio mode
2. Copier la commande MCP affichée
3. Configurer Claude Code avec cette commande
4. Tester les ressources et outils MCP

## Phase 4: Améliorations (Futures)

### 4.1 Export Configuration MCP
Option pour exporter la configuration vers un fichier `mcp.json`:
```typescript
// Dans studio.ts
if (options.exportMcpConfig) {
  const mcpConfig = {
    mcpServers: {
      "vue-skuilder-studio": {
        command: "node",
        args: [mcpServerPath, unpackResult.courseId],
        env: mcpConnectionInfo.env
      }
    }
  };
  
  fs.writeFileSync('mcp.json', JSON.stringify(mcpConfig, null, 2));
  console.log(chalk.green('📄 MCP config exported to mcp.json'));
}
```

### 4.2 Serveur HTTP MCP (Phase Future)
Plus tard, ajouter support pour transport HTTP :
- Serveur MCP intégré dans Express
- Endpoint `/mcp` pour les clients HTTP
- Configuration via `--mcp-http` flag

## Livrables

1. **mcp-server.ts** - Exécutable MCP standalone
2. **studio.ts modifié** - Affichage des infos de connexion MCP
3. **package.json CLI mis à jour** - Dépendances et build
4. **Documentation** - Comment utiliser MCP avec studio mode

## Critères de Succès

- [ ] `skuilder studio` affiche la commande de connexion MCP
- [ ] MCP Inspector peut se connecter au serveur
- [ ] Claude Code peut utiliser le serveur MCP
- [ ] Toutes les ressources/outils MCP fonctionnent
- [ ] Arrêt propre du studio (pas de processus orphelins)