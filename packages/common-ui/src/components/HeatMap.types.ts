import type { Moment } from 'moment';

export interface DayData {
  date: string;
  count: number;
}

export interface Color {
  h: number;
  s: number;
  l: number;
}

export interface ActivityRecord {
  // number | ISO string, but stored records may carry a Moment or Date
  timeStamp: number | string | Date | Moment;
  [key: string]: unknown;
}
