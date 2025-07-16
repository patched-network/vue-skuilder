// Resource types
export * from './resources.js';

// Tool types  
export * from './tools.js';

// Common types
export interface SourceReference {
  type: 'git' | 'file' | 'url';
  source: string;      // repo URL, file path, etc.
  reference: string;   // commit hash, line numbers, etc.
  milestone?: string;  // tag, release, branch
  timestamp: string;   // ISO date
}

export interface ELOContext {
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

export interface ContentWithELO {
  content: any;
  estimatedElo: number;
  eloConfidence: number;
  referenceCards?: string[];
}