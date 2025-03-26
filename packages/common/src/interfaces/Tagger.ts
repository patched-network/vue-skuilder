/**
 * A tagger is *some function* that produces a list of tags - ie, strings.
 */
export interface Tagger {
  (x: any): string[];
}
