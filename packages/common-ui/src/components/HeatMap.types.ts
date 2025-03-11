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
  timeStamp: number | string;
  [key: string]: any;
}
