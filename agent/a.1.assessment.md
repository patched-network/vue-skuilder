# Assessment: MCP Package for Vue-Skuilder Course Content Agent Access

## Context Analysis

Vue-Skuilder est un système sophistiqué de gestion de contenu éducatif avec une architecture modulaire bien conçue. Le système actuel comprend :

### Architecture Existante

**Backend Core:**
- `@vue-skuilder/db` - Couche d'abstraction de données supportant CouchDB dynamique et données statiques JSON
- `@vue-skuilder/express` - Serveur API REST avec authentification, préprocessing de médias, gestion de cours
- `@vue-skuilder/common` - Types partagés, interfaces, et utilitaires métier

**Data Models Clés:**
- **Courses**: Configuration, cartes, ratings ELO, système de révision espacée
- **Cards**: Contenu d'apprentissage avec tags, attachments media, données ELO
- **DataShapes**: Système de types pour différents formats de questions
- **Study Sessions**: Logique de présentation de contenu avec tracking de progression
- **Content Sources**: Abstraction pour cours et salles de classe

**Patterns Architecturaux:**
- Interface Provider pattern pour la couche de données
- Dual export system (CommonJS/ESM) pour compatibilité maximale  
- Système de registration de composants pour découverte automatique
- Configuration build partagée avec alias cross-package

## Objectif du Package MCP

Créer un nouveau package `@vue-skuilder/mcp` qui :
1. Expose les données de cours via le protocole MCP pour accès par des agents
2. Permettra l'intégration avec le serveur Express existant
3. Activera la génération automatisée de contenu de quiz annoté et lié aux sources
4. Supportera l'attachement d'un processus agentique à un répertoire source

## Options d'Architecture

### Option A: Serveur MCP Standalone Intégré

**Approche:** Créer un serveur MCP autonome qui utilise la couche `db` existante et s'intègre comme middleware Express.

**Structure Proposée:**
```
packages/mcp/
├── src/
│   ├── server/          # Serveur MCP core
│   ├── resources/       # Ressources MCP (courses, cards, content)
│   ├── tools/           # Outils MCP (create, update, analyze)
│   ├── prompts/         # Templates de prompts pour génération de contenu
│   ├── integrations/    # Intégration Express middleware
│   └── types/           # Types spécifiques MCP
└── examples/            # Exemples d'usage
```

**Avantages:**
- Réutilise l'infrastructure data layer existante
- Intégration native avec l'écosystème Vue-Skuilder
- Peut bénéficier de l'authentification Express existante
- Support direct des DataShapes et patterns existants

**Inconvénients:**
- Complexité d'intégration avec l'Express server existant
- Nécessite coordination avec l'architecture existante

### Option B: Serveur MCP Hybride avec Accès Direct

**Approche:** Serveur MCP qui peut fonctionner standalone OU comme service intégré, avec accès direct aux APIs data layer.

**Structure Proposée:**
```
packages/mcp/
├── src/
│   ├── core/            # Core MCP functionality
│   ├── adapters/        # Adaptateurs pour différentes sources (db, files, git)
│   ├── services/        # Services métier (quiz generation, content analysis)
│   ├── transports/      # Transports MCP (stdio, http)
│   ├── middleware/      # Express integration layer
│   └── cli/             # CLI pour usage standalone
└── docs/                # Documentation et exemples
```

**Avantages:**
- Flexibilité maximale (standalone ou intégré)
- Peut accéder à différents types de sources de contenu
- Extensible pour futurs cas d'usage
- Découplage propre des concerns

**Inconvénients:**
- Plus complexe à implémenter initialement
- Risque de duplication avec la couche db existante

### Option C: Extension MCP de la Couche DB

**Approche:** Étendre les interfaces de la couche `db` existante avec des capabilities MCP natives.

**Structure Proposée:**
```
packages/mcp/
├── src/
│   ├── providers/       # MCP data providers étendant DataLayerProvider
│   ├── transforms/      # Transformateurs data → MCP resources
│   ├── generators/      # Générateurs de contenu (quiz, annotations)
│   └── server.ts        # MCP server factory
└── integration/         # Helpers d'intégration Express
```

**Avantages:**
- Réutilisation maximale du code existant
- Consistency avec les patterns architecturaux
- Implémentation plus rapide
- Intégration naturelle avec les types existants

**Inconvénients:**
- Couplage plus fort avec l'architecture db
- Moins de flexibilité pour sources externes

## Services MCP Proposés

### Resources
- `course://[courseId]` - Configuration et métadonnées de cours
- `cards://[courseId]/[filter]` - Cartes de cours avec filtres optionnels
- `content://[courseId]/[cardId]` - Contenu détaillé d'une carte
- `tags://[courseId]` - Système de tags et taxonomie
- `schema://[courseId]` - DataShapes et structure de données

### Tools
- `analyze_content` - Analyser le contenu source pour opportunités de quiz
- `generate_quiz` - Générer des questions basées sur le contenu source
- `annotate_content` - Créer des annotations liées aux sources
- `validate_quiz` - Valider la qualité des questions générées
- `link_sources` - Créer des liens entre contenu et sources

### Prompts
- `quiz_generation` - Template pour génération structurée de quiz
- `content_analysis` - Template pour analyse de contenu source
- `annotation_creation` - Template pour création d'annotations

## Phases d'Implémentation

### Phase 1: Foundation (MVP)
1. Création du package structure de base
2. Serveur MCP minimal avec ressources cours read-only
3. Integration basique avec Express middleware
4. Tests de bout en bout avec Claude Desktop

### Phase 2: Content Access
1. Resources complètes (courses, cards, tags, schema)
2. Tools de lecture et navigation
3. Support des DataShapes existants
4. Documentation et exemples

### Phase 3: Content Generation
1. Tools de création et modification de contenu
2. Générateurs de quiz avec templates
3. Système d'annotations linkées aux sources
4. Integration avec file system pour source scanning

### Phase 4: Advanced Features
1. Support de différents transports (stdio, HTTP)
2. Authentication et permissions
3. Streaming et performance optimization
4. Analytics et monitoring

# Recommendation

**Option B - Serveur MCP Hybride** est l'approche recommandée car elle offre :

1. **Flexibilité maximale** pour différents cas d'usage
2. **Extensibilité** pour futurs besoins
3. **Découplage propre** des concerns
4. **Path de migration naturel** vers des fonctionnalités avancées

L'implémentation commencerait par un serveur MCP minimal réutilisant la couche `db` existante, puis évolurait vers un système plus sophistiqué avec support de sources multiples et génération de contenu avancée.

Cette approche permet une **verification incrémentale** à chaque phase et une **integration graduelle** avec l'écosystème Vue-Skuilder existant.