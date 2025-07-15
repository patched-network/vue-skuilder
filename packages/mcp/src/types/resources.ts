import type { CourseConfig } from '@vue-skuilder/common';

// Resource type definitions - will be expanded in Phase 2
export interface CourseResource {
  config: CourseConfig;
  eloStats: {
    min: number;
    max: number;
    mean: number;
    distribution: number[];
  };
}

export interface CardResource {
  id: string;
  shape: string;
  tags: string[];
  elo: number;
  // Additional card metadata
}