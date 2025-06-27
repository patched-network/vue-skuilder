// Type declarations for @vue-skuilder/courses/logic
// Extracted business logic types for Node.js compatibility

export interface ParsedBlank {
  answers: string[];
  options: string[] | null; // null for fill-in-blank, array for multiple choice
}

export interface ViewData {
  [key: string]: any;
  content?: string;
}

export declare class BlanksCard {
  mdText: string;
  answers: string[];
  options: string[] | null;

  constructor(data: ViewData[]);
  isCorrect(answer: any): boolean;
}

export declare function gradeSpellingAttempt(attempt: string, answer: string): string;

export declare function optionsFromString(s: string): ParsedBlank;
export declare function splitByDelimiters(text: string, leftDelim: string, rightDelim: string): any[];