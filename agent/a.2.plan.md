# Plan: MCP Package for Vue-Skuilder Course Content Agent Access

## Architecture Overview

Créer un nouveau package `@vue-skuilder/mcp` qui expose les données de cours Vue-Skuilder via le protocole Model Context Protocol (MCP), permettant aux agents d'accéder et de générer du contenu de cours de manière structurée avec support natif du système ELO.

## Core Design Principles

1. **Interface-Based Architecture**: MCP server accepte un `CourseDBInterface` en constructor, découplant la gestion des données
2. **Course-Scoped Servers**: Un serveur MCP par cours pour isolation et sécurité
3. **DataShape Aware**: Support natif des types de questions Vue-Skuilder existants et nouveaux
4. **ELO-Driven Content**: Intégration native du système de rating ELO pour génération et organisation de contenu
5. **Source Linking**: Tracking des sources avec git commit/milestone references
6. **Incremental Verification**: Chaque phase est testable et déployable independamment

## Package Structure

```
packages/mcp/
├── src/
│   ├── server.ts           # MCPServer class principal
│   ├── resources/          # MCP Resources implementation
│   │   ├── course.ts       # course:// - config et métadonnées
│   │   ├── cards.ts        # cards:// - cartes existantes
│   │   ├── shapes.ts       # shapes:// - DataShapes disponibles
│   │   ├── elo.ts          # elo:// - distribution et analytics ELO
│   │   ├── tags.ts         # tags:// - tag exploration et analytics
│   │   └── index.ts        # Resource registry
│   ├── tools/              # MCP Tools implementation
│   │   ├── content/        # Outils de génération de contenu
│   │   │   └── explore-and-generate-courseware.ts
│   │   ├── management/     # Outils de gestion de cours
│   │   │   ├── create-card.ts
│   │   │   ├── update-card.ts
│   │   │   ├── tag-card.ts
│   │   │   └── rate-content.ts
│   │   └── index.ts        # Tools registry
│   ├── prompts/            # MCP Prompts templates
│   │   ├── quiz-generation.ts
│   │   ├── content-analysis.ts
│   │   ├── elo-calibration.ts
│   │   └── index.ts        # Prompts registry
│   ├── types/              # Types spécifiques MCP
│   │   ├── resources.ts    # Resource type definitions
│   │   ├── tools.ts        # Tool input/output schemas
│   │   └── index.ts
│   └── utils/              # Utilitaires
│       ├── source-linking.ts
│       ├── datashape-helpers.ts
│       └── elo-helpers.ts
├── examples/               # Exemples d'usage
│   ├── local-dev.ts        # Setup pour développement local
│   └── express-integration.ts # Exemple d'intégration Express
├── package.json
├── tsconfig.json
├── CLAUDE.md              # Documentation pour Claude Code
└── README.md              # Documentation générale
```

## MCP Services Specification

### Resources

#### `course://config`
- **Description**: Configuration et métadonnées du cours
- **Data**: CourseConfig + DataShapes disponibles + statistiques + distribution ELO
- **URI Pattern**: `course://config`

#### `cards://[filter]`
- **Description**: Liste des cartes avec filtres optionnels
- **URI Patterns**: 
  - `cards://all` - Toutes les cartes
  - `cards://tag/[tagName]` - Cartes par tag
  - `cards://shape/[shapeName]` - Cartes par DataShape
  - `cards://elo/[min]-[max]` - Cartes dans une fourchette ELO
- **Data**: Liste de cartes avec métadonnées (ID, tags, shape, ELO, etc.)

#### `shapes://[shapeName]`
- **Description**: Définitions des DataShapes pour génération de contenu
- **URI Patterns**:
  - `shapes://all` - Toutes les DataShapes
  - `shapes://[shapeName]` - DataShape spécifique
- **Data**: FieldDefinitions, validation rules, exemples

#### `elo://[aspect]`
- **Description**: Analytics et distribution ELO du cours
- **URI Patterns**:
  - `elo://distribution` - Distribution ELO complète du cours
  - `elo://stats` - Statistiques ELO (moyenne, médiane, quartiles)
  - `elo://cards/[min]-[max]` - Cartes dans une fourchette ELO
  - `elo://gaps` - Identification des gaps dans la distribution
- **Data**: Données ELO pour calibration et génération de contenu

#### `tags://[aspect]`
- **Description**: Tag exploration et analytics du cours
- **URI Patterns**:
  - `tags://all` - Tous les tags disponibles dans le cours
  - `tags://stats` - Statistiques d'usage des tags
  - `tags://[tagName]` - Détails d'un tag spécifique + nombre de cartes
  - `tags://union/[tag1]+[tag2]` - Cartes ayant AU MOINS UN de ces tags
  - `tags://intersect/[tag1]+[tag2]` - Cartes ayant TOUS ces tags
  - `tags://exclusive/[tag1]-[tag2]` - Cartes avec tag1 mais PAS tag2
  - `tags://distribution` - Distribution de fréquence des tags
- **Data**: Informations sur les tags pour organisation et filtrage de contenu

### Tools

#### Content Generation Tools

**`explore_and_generate_courseware`**
- **Input**: `{ sourceText?: string, filePath?: string, contentType?: 'markdown'|'code'|'text', targetDataShapes?: DataShapeName[], targetElo?: number, sourceRef?: string, generationMode?: 'analyze' | 'generate' | 'both' }`
- **Output**: Orchestrated content generation with analysis, suggestions, and created cards
- **Purpose**: Single orchestrating tool that analyzes source content and generates appropriate courseware using internal prompts and multiple create_card calls

#### Content Management Tools

**`create_card`**
- **Input**: `{ shape: DataShapeName, data: any, tags?: string[], sourceRef?: string, suggestedElo?: number }`
- **Output**: Nouvelle carte créée avec ID et ELO initial
- **Purpose**: Créer du contenu de cours structuré avec rating initial

**`update_card`**
- **Input**: `{ cardId: string, updates: Partial<CardData> }`
- **Output**: Carte mise à jour
- **Purpose**: Modifier le contenu existant

**`rate_content`**
- **Input**: `{ cardId: string, suggestedElo: number, reasoning?: string, referenceCards?: string[] }`
- **Output**: ELO mis à jour avec justification
- **Purpose**: Calibrer la difficulté relative du contenu

**`tag_card`**
- **Input**: `{ cardId: string, tags: string[] }`
- **Output**: Tags appliqués
- **Purpose**: Organiser et catégoriser le contenu

#### ELO Analysis Tools

**`suggest_elo_calibration`**
- **Input**: `{ cardId: string, similarityContext?: string[] }`
- **Output**: ELO suggéré basé sur cartes similaires
- **Purpose**: Aider à calibrer de nouvelles cartes par rapport au contenu existant

**`identify_elo_gaps`**
- **Input**: `{ targetDistribution?: 'uniform' | 'normal' | 'custom' }`
- **Output**: Fourchettes ELO sous-représentées avec suggestions
- **Purpose**: Identifier où générer du contenu pour équilibrer la difficulté

### Prompts

**`quiz_generation`**
- **Args**: `{ topic: string, sourceType: string, targetElo: number, courseEloContext: { min: number, max: number, mean: number } }`
- **Template**: Prompt structuré pour génération cohérente de quiz calibrés ELO
- **Purpose**: Guider l'agent dans la création de contenu éducatif avec difficulté appropriée

**`content_analysis`**
- **Args**: `{ contentType: string, analysisGoal: string, eloReference?: number }`
- **Template**: Prompt pour analyse systématique de contenu source avec perspective ELO
- **Purpose**: Identifier et extraire des éléments éducatifs pertinents avec calibrage difficulté

**`elo_calibration`**
- **Args**: `{ contentDescription: string, existingEloRange: { min: number, max: number }, referenceCards?: string[] }`
- **Template**: Prompt pour estimer l'ELO approprié d'un contenu
- **Purpose**: Aider à situer relativement la difficulté de nouveau contenu

## Technical Implementation

### Dependencies
```json
{
  "@modelcontextprotocol/sdk": "^0.5.0",
  "@vue-skuilder/db": "workspace:*",
  "@vue-skuilder/common": "workspace:*",
  "zod": "^3.22.0"
}
```

### Core Class Structure
```typescript
export class MCPServer {
  constructor(
    private courseDB: CourseDBInterface,
    private options?: MCPServerOptions
  );
  
  async start(transport: Transport): Promise<void>;
  async stop(): Promise<void>;
}

export interface MCPServerOptions {
  enableSourceLinking?: boolean;
  maxCardsPerQuery?: number;
  allowedDataShapes?: DataShapeName[];
  eloCalibrationMode?: 'strict' | 'adaptive' | 'manual';
}
```

### Source Linking Format
```typescript
interface SourceReference {
  type: 'git' | 'file' | 'url';
  source: string;      // repo URL, file path, etc.
  reference: string;   // commit hash, line numbers, etc.
  milestone?: string;  // tag, release, branch
  timestamp: string;   // ISO date
}
```

### ELO Integration Types
```typescript
interface ELOContext {
  current: number;
  confidence: number;
  distribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
    quartiles: [number, number, number];
  };
}

interface ContentWithELO {
  content: any;
  estimatedElo: number;
  eloConfidence: number;
  referenceCards?: string[];
}
```

## Integration Points

### Local Development
```typescript
// Setup pour développement local
import { getDataLayer } from '@vue-skuilder/db';
import { MCPServer } from '@vue-skuilder/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const courseDB = getDataLayer().getCourseDB('my-course-id');
const server = new MCPServer(courseDB, {
  eloCalibrationMode: 'adaptive'
});
const transport = new StdioServerTransport();
await server.start(transport);
```

### Express Integration (Future)
```typescript
// Dans Express route handler
app.all('/api/courses/:courseId/mcp', async (req, res) => {
  const courseDB = req.courseDB; // Injecté par middleware auth
  const server = new MCPServer(courseDB, {
    eloCalibrationMode: 'strict' // Production mode
  });
  
  // Handle MCP over HTTP
  await handleMCPRequest(server, req, res);
});
```

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Package setup avec build system (tsup, dual exports)
- [ ] MCPServer class de base avec CourseDBInterface injection
- [ ] Resource basique `course://config` avec données ELO
- [ ] Tool basique `create_card` avec support ELO initial
- [ ] Tests de bout en bout avec Claude Desktop

### Phase 2: Core Resources & Tools
- [ ] Resources complètes (cards, shapes, elo basics)
- [ ] Tools de génération de contenu (fillblank, multiple choice) avec targetElo
- [ ] Support des DataShapes existants
- [ ] Tool `analyze_source` pour fichiers markdown avec estimation ELO

### Phase 3: ELO Intelligence & Source Linking
- [ ] Resource `elo://` complète avec analytics avancées
- [ ] Tools `rate_content`, `suggest_elo_calibration`, `identify_elo_gaps`
- [ ] Système de source references avec git tracking
- [ ] Prompts `elo_calibration` pour rating intelligent

### Phase 4: Advanced Analysis & Integration
- [ ] Integration avec file system scanning
- [ ] Tools avancés d'analyse de contenu avec calibrage ELO automatique
- [ ] Optimisation des performances et caching
- [ ] Integration helpers pour Express avec gestion auth

## Success Criteria

**Phase 1 Success:**
- Agent peut lire la configuration d'un cours avec distribution ELO via MCP
- Agent peut créer une nouvelle carte avec ELO initial estimé
- Tests passent avec un vrai CourseDBInterface

**Phase 2 Success:**
- Agent peut générer du contenu calibré à un ELO cible
- Agent peut analyser la distribution ELO d'un cours
- Génération de contenu respecte les DataShapes existants

**Final Success:**
- Agent peut analyser un répertoire source (ex: golang std lib docs)
- Génère automatiquement du contenu de quiz structuré, source-linked, et calibré ELO
- Agent peut identifier et combler les gaps dans la distribution ELO
- Integration transparente avec workflow de développement existant

## Risk Mitigation

1. **Complexité ELO**: Commencer avec ELO basique, élaborer vers analytics avancées
2. **Calibrage ELO**: Mode adaptatif pour apprentissage progressif du système
3. **Performance**: Limites sur taille des queries, pagination pour grandes collections
4. **Data Consistency**: Validation stricte des inputs via Zod schemas incluant ELO ranges
5. **Integration**: Interface découplée permet testing indépendant de Express

Cette approche assure une **verification incrémentale** à chaque étape et une **integration graduelle** avec l'écosystème Vue-Skuilder existant, en respectant le système ELO comme primitive core.