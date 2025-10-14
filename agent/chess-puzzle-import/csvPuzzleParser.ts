/**
 * CSV Parser for Lichess Chess Puzzle Database
 *
 * Parses Lichess puzzle CSV format:
 * PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 *
 * Maps to vue-skuilder format:
 * - Full CSV row → puzzleData field
 * - Themes + OpeningTags → tags array (openings prefixed with "opening:")
 * - Rating → elo
 */

import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Parsed puzzle ready for import into vue-skuilder
 */
export interface ParsedPuzzle {
  /** Full CSV row as comma-delimited string (for puzzleData field) */
  puzzleData: string;

  /** Extracted tags: themes + "opening:" prefixed openings */
  tags: string[];

  /** Lichess rating (maps to vue-skuilder ELO) */
  elo: number;

  /** Puzzle ID (for logging/debugging) */
  puzzleId: string;

  /** Raw parsed data (optional, for debugging) */
  rawData?: {
    fen: string;
    moves: string;
    themes: string[];
    openings: string[];
    gameUrl: string;
  };
}

/**
 * Statistics from CSV parsing
 */
export interface ParseStats {
  /** Total lines processed (excluding header) */
  totalLines: number;

  /** Successfully parsed puzzles */
  parsed: number;

  /** Failed to parse */
  failed: number;

  /** Lines skipped (empty, malformed) */
  skipped: number;
}

/**
 * Extract tags from themes and openings columns
 *
 * @param themes - Space-separated themes (index 7)
 * @param openings - Space-separated openings (index 9, may be empty)
 * @returns Combined tag array
 */
function extractTags(themes: string, openings: string): string[] {
  const tags: string[] = [];

  // Extract theme tags
  if (themes && themes.trim()) {
    const themeTags = themes.split(' ')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    tags.push(...themeTags);
  }

  // Extract opening tags with "opening:" prefix
  if (openings && openings.trim()) {
    const openingTags = openings.split(' ')
      .map(o => o.trim())
      .filter(o => o.length > 0)
      .map(o => `opening:${o}`);
    tags.push(...openingTags);
  }

  return tags;
}

/**
 * Parse a single CSV line into a ParsedPuzzle
 *
 * @param csvLine - Raw CSV line from Lichess database
 * @param includeRawData - Include parsed raw data for debugging
 * @returns ParsedPuzzle or null if parsing fails
 */
export function parsePuzzleCSV(
  csvLine: string,
  includeRawData: boolean = false
): ParsedPuzzle | null {
  // Trim whitespace
  const trimmed = csvLine.trim();

  if (!trimmed) {
    return null;
  }

  // Split on commas
  // Note: This is a simple split. If FEN or other fields contain commas,
  // we'd need a proper CSV parser. Lichess data doesn't have this issue.
  const fields = trimmed.split(',');

  // Validate field count (9 or 10, depending on trailing comma)
  if (fields.length < 9 || fields.length > 10) {
    console.warn(`Invalid CSV line: expected 9-10 fields, got ${fields.length}`);
    return null;
  }

  // Extract fields by index
  const [
    puzzleId,
    fen,
    moves,
    ratingStr,
    ratingDeviation,
    popularity,
    nbPlays,
    themes,
    gameUrl,
    openings = '', // May be empty (trailing comma case)
  ] = fields;

  // Validate required fields
  if (!puzzleId || !fen || !moves || !ratingStr) {
    console.warn(`Missing required fields in CSV line: ${csvLine.substring(0, 80)}...`);
    return null;
  }

  // Parse rating as integer
  const elo = parseInt(ratingStr, 10);
  if (isNaN(elo)) {
    console.warn(`Invalid rating in CSV line: ${ratingStr}`);
    return null;
  }

  // Extract tags
  const tags = extractTags(themes, openings);

  // Build result
  const result: ParsedPuzzle = {
    puzzleData: trimmed, // Store full CSV row
    tags,
    elo,
    puzzleId,
  };

  // Optionally include raw data for debugging
  if (includeRawData) {
    result.rawData = {
      fen,
      moves,
      themes: themes ? themes.split(' ').filter(t => t) : [],
      openings: openings ? openings.split(' ').filter(o => o) : [],
      gameUrl,
    };
  }

  return result;
}

/**
 * Stream a CSV file and parse puzzles line by line
 *
 * @param filePath - Path to CSV file
 * @param onPuzzle - Callback for each successfully parsed puzzle
 * @param onProgress - Optional callback for progress updates (every N puzzles)
 * @param options - Parsing options
 * @returns Parse statistics
 */
export async function parsePuzzleCSVStream(
  filePath: string,
  onPuzzle: (puzzle: ParsedPuzzle) => Promise<void>,
  onProgress?: (stats: ParseStats) => void,
  options: {
    progressInterval?: number; // Report progress every N puzzles (default: 1000)
    skipHeader?: boolean; // Skip first line as header (default: true)
    limit?: number; // Stop after N puzzles (default: no limit)
    includeRawData?: boolean; // Include raw data in ParsedPuzzle (default: false)
  } = {}
): Promise<ParseStats> {
  const {
    progressInterval = 1000,
    skipHeader = true,
    limit = 0,
    includeRawData = false,
  } = options;

  // Check file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  // Initialize statistics
  const stats: ParseStats = {
    totalLines: 0,
    parsed: 0,
    failed: 0,
    skipped: 0,
  };

  // Create read stream
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Treat \r\n as single line break
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;

    // Skip header line
    if (skipHeader && lineNumber === 1) {
      continue;
    }

    stats.totalLines++;

    // Check limit
    if (limit > 0 && stats.parsed >= limit) {
      console.log(`Reached limit of ${limit} puzzles, stopping`);
      break;
    }

    // Skip empty lines
    if (!line.trim()) {
      stats.skipped++;
      continue;
    }

    // Parse puzzle
    const puzzle = parsePuzzleCSV(line, includeRawData);

    if (puzzle) {
      try {
        await onPuzzle(puzzle);
        stats.parsed++;

        // Report progress
        if (onProgress && stats.parsed % progressInterval === 0) {
          onProgress(stats);
        }
      } catch (error) {
        console.error(`Failed to process puzzle ${puzzle.puzzleId}:`, error);
        stats.failed++;
      }
    } else {
      stats.failed++;
    }
  }

  // Final progress report
  if (onProgress) {
    onProgress(stats);
  }

  return stats;
}

/**
 * Parse entire CSV file into memory (use with caution for large files!)
 *
 * @param filePath - Path to CSV file
 * @param options - Parsing options
 * @returns Array of parsed puzzles
 */
export async function parsePuzzleCSVFile(
  filePath: string,
  options: {
    skipHeader?: boolean;
    limit?: number;
    includeRawData?: boolean;
  } = {}
): Promise<ParsedPuzzle[]> {
  const puzzles: ParsedPuzzle[] = [];

  await parsePuzzleCSVStream(
    filePath,
    async (puzzle) => {
      puzzles.push(puzzle);
    },
    undefined,
    options
  );

  return puzzles;
}
