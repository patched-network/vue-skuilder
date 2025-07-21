# Assessment: Intégrer le serveur MCP dans Studio Mode

## Contexte Actuel

Le mode studio (`skuilder studio`) dans `packages/cli` lance actuellement :
1. **CouchDB** - Base de données temporaire via Docker
2. **Express Backend** - API backend (port 3001+)  
3. **Studio-UI** - Interface web de modification (port 7174+)

Le serveur **MCP** (`packages/mcp`) expose :
- 14 ressources de lecture (course, cards, tags, shapes, elo)
- 4 outils d'écriture (create, update, tag, delete cards)
- 2 prompts de génération (fill-in cards, ELO guidance)

## Options d'Intégration

### Option 1: Serveur MCP Intégré (RECOMMANDÉ)
**Architecture**: Le CLI lance le serveur MCP en parallèle avec les autres services

**Implémentation**:
```typescript
// Dans studio.ts
class MCPManager {
  private mcpServer: MCPServer;
  private transport: StdioServerTransport;
  
  async start(courseDB: CourseDBInterface): Promise<MCPConnectionInfo> {
    this.mcpServer = new MCPServer(courseDB);
    this.transport = new StdioServerTransport();
    await this.mcpServer.start(this.transport);
    return { command: 'node', args: [mcpServerPath] };
  }
}
```

**Avantages**:
- Accès direct à la base de données CouchDB du studio
- Intégration native avec le cycle de vie du studio
- Configuration automatique (pas de setup utilisateur)
- Arrêt propre avec le studio

**Inconvénients**:
- Plus de complexité dans le gestionnaire du studio
- Dépendance directe entre CLI et MCP

### Option 2: Serveur MCP Externe avec Bundle
**Architecture**: Le CLI bundle le serveur MCP lors du build et l'expose comme exécutable

**Implémentation**:
```typescript
// Dans le build du CLI
copyDirectory('packages/mcp/dist', 'packages/cli/dist/mcp-assets');

// Dans studio.ts
const mcpServerPath = path.join(__dirname, 'mcp-assets', 'standalone-server.mjs');
const mcpProcess = spawn('node', [mcpServerPath, courseId]);
```

**Avantages**:
- Découplage complet entre CLI et MCP
- Le serveur MCP peut être utilisé indépendamment
- Plus simple à déboguer
- Configuration via variables d'environnement

**Inconvénients**:
- Nécessite un build séparé du serveur MCP
- Plus de taille dans le package CLI

### Option 3: Transport HTTP pour MCP
**Architecture**: Serveur MCP sur HTTP au lieu de stdio

**Implémentation**:
```typescript
// Serveur MCP avec transport HTTP
const mcpServer = new MCPServer(courseDB);
const httpTransport = new StreamableHTTPServerTransport();
app.use('/mcp', mcpTransport.handler);
```

**Avantages**:
- Intégration avec l'infrastructure HTTP existante
- Pas de processus séparé
- Facile à tester avec des outils HTTP

**Inconvénients**:
- Les clients MCP doivent supporter HTTP (pas stdio)
- Plus complexe pour l'usage en développement local

## Détails d'Implémentation

### Configuration de Connexion
Pour tous les scénarios, le studio doit communiquer les détails de connexion :

```typescript
interface MCPConnectionInfo {
  command: string;        // 'node'
  args: string[];        // ['path/to/mcp-server.mjs', courseId]
  env?: Record<string, string>;  // Variables d'environnement
  cwd?: string;          // Répertoire de travail
}
```

### Gestion du Cycle de Vie
```typescript
// Dans stopStudioSession()
async function stopStudioSession(): Promise<void> {
  if (mcpManager) {
    await mcpManager.stop();
    mcpManager = null;
  }
  // ... autres arrêts
}
```

### Logs et Debugging
```typescript
const mcpManager = new MCPManager({
  onLog: (message) => console.log(chalk.gray(`   MCP: ${message}`)),
  onError: (error) => console.error(chalk.red(`   MCP Error: ${error}`)),
});
```

## Considérations pour le Développement Local

### MCP Inspector Integration
Le studio pourrait automatiquement lancer l'inspecteur MCP :
```typescript
if (process.env.MCP_INSPECTOR_MODE) {
  // Lance l'inspecteur sur port 6274
  spawn('npx', ['@modelcontextprotocol/inspector', ...mcpArgs]);
}
```

### Configuration de Cours
Le serveur MCP nécessite l'ID du cours et les détails de connexion CouchDB :
```typescript
const mcpConfig = {
  courseId: unpackResult.courseId,
  couchdb: couchDBManager.getConnectionDetails()
};
```

## Patterns Existants

Le CLI utilise déjà des patterns similaires :
- **ExpressManager**: Gère le processus Express backend
- **CouchDBManager**: Gère le conteneur Docker CouchDB
- **StudioUIServer**: Gère le serveur de fichiers statiques

Le **MCPManager** suivrait la même approche.

# Recommandation

**Option 1: Serveur MCP Intégré** est la meilleure approche pour les raisons suivantes :

1. **Simplicité d'usage** - L'utilisateur n'a rien à configurer
2. **Intégration native** - Accès direct aux données du studio
3. **Consistance** - Suit les patterns existants (ExpressManager, etc.)
4. **Développement local** - Facile à déboguer et tester

### Étapes d'Implémentation

1. **Créer MCPManager** dans `packages/cli/src/utils/`
2. **Modifier studio.ts** pour inclure la gestion MCP
3. **Bundle du serveur MCP** dans le build du CLI
4. **Tests et validation** avec l'inspecteur MCP
5. **Documentation** des commandes de connexion MCP

### Output Attendu

À la fin du processus, `skuilder studio` affichera :
```
✅ Studio session ready!
🎨 Studio URL: http://localhost:7174
🗄️  Database: studio-course-123 on port 5985
⚡ Express API: http://localhost:3001
🔗 MCP Server: node dist/mcp-server.mjs course-id
   Press Ctrl+C to stop studio session
```

L'utilisateur peut alors connecter des clients MCP (comme Claude Code) en utilisant la commande fournie.