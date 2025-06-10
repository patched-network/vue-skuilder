// packages/db/src/util/packer/types.ts

import { CourseConfig } from '@vue-skuilder/common';
import { DocType } from '../../core/types/types-legacy';

export interface StaticCourseManifest {
  version: string;
  courseId: string;
  courseName: string;
  courseConfig: CourseConfig | null; // Full CourseConfig object
  lastUpdated: string;
  documentCount: number;
  chunks: ChunkMetadata[];
  indices: IndexMetadata[];
  designDocs: DesignDocument[];
}

export interface ChunkMetadata {
  id: string;
  docType: DocType;
  startKey: string;
  endKey: string;
  documentCount: number;
  path: string; // Relative path for file writing
}

export interface IndexMetadata {
  name: string;
  type: 'btree' | 'hash' | 'spatial';
  path: string; // Relative path for file writing
}

export interface DesignDocument {
  _id: string;
  views: {
    [viewName: string]: {
      map: string;
      reduce?: string;
    };
  };
}

export interface PackerConfig {
  chunkSize: number;
  includeAttachments: boolean;
}

export interface PackedCourseData {
  manifest: StaticCourseManifest;
  chunks: Map<string, any[]>; // chunkId -> documents
  indices: Map<string, any>; // indexName -> index data
}
