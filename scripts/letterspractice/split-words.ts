#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
const exec = promisify(execCallback);

import FFMPEGstatic from 'ffmpeg-static';

if (!FFMPEGstatic) {
  error('FFMPEGstatic executable not found');
  process.exit(1);
}

const FFMPEG = FFMPEGstatic as unknown as string;

// Padding added to each segment boundary (seconds)
const SEGMENT_PADDING = 0.2; // 200ms

function log(s: string) {
  // eslint-disable-next-line no-console
  console.log(s);
}
function error(s: string) {
  // eslint-disable-next-line no-console
  console.error(s);
}

function showUsage() {
  log(`
Usage: tsx split-words.ts <audio-file> <word-list> [-o <output-dir>] [--noise <dB>] [--min-silence <seconds>]

Arguments:
  <audio-file>       Path to the full session recording (.wav)
  <word-list>        Text file with one word per line, in recording order

Options:
  -o <output-dir>    Directory to write split .wav files (created if needed)
                     Default: current directory
  --noise <dB>       Silence detection threshold (default: -30dB)
  --min-silence <s>  Minimum silence duration in seconds (default: 0.3)
  -h, --help         Show this help message

Examples:
  tsx split-words.ts session-denoised.wav wordlist.txt
  tsx split-words.ts session-denoised.wav wordlist.txt -o ./split-output
  tsx split-words.ts session-denoised.wav wordlist.txt --noise -35dB --min-silence 0.4
`);
}

interface SilenceInterval {
  start: number;
  end: number;
}

interface SpeechSegment {
  start: number;
  end: number;
}

/**
 * Runs ffmpeg silencedetect and parses the output into silence intervals.
 */
async function detectSilences(
  audioPath: string,
  noiseThreshold: string,
  minSilenceDuration: number
): Promise<SilenceInterval[]> {
  const result = await exec(
    `"${FFMPEG}" -i "${audioPath}" -af silencedetect=noise=${noiseThreshold}:d=${minSilenceDuration} -f null -`
  );

  const lines = result.stderr.split('\n');
  const silences: SilenceInterval[] = [];
  let currentStart: number | null = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) {
      currentStart = parseFloat(startMatch[1]);
      continue;
    }

    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && currentStart !== null) {
      silences.push({ start: currentStart, end: parseFloat(endMatch[1]) });
      currentStart = null;
    }
  }

  // If there's an unclosed silence at the end (audio ends in silence),
  // we don't need to track it — there's no speech after it.

  return silences;
}

/**
 * Derives speech segments from the gaps between silence intervals.
 * Speech is everything that isn't silence.
 */
function deriveSpeechSegments(
  silences: SilenceInterval[],
  totalDuration: number
): SpeechSegment[] {
  const segments: SpeechSegment[] = [];

  if (silences.length === 0) {
    // No silence found — entire file is one segment
    segments.push({ start: 0, end: totalDuration });
    return segments;
  }

  // Speech before the first silence
  if (silences[0].start > 0.01) {
    segments.push({ start: 0, end: silences[0].start });
  }

  // Speech between consecutive silences
  for (let i = 0; i < silences.length - 1; i++) {
    const speechStart = silences[i].end;
    const speechEnd = silences[i + 1].start;
    if (speechEnd - speechStart > 0.01) {
      segments.push({ start: speechStart, end: speechEnd });
    }
  }

  // Speech after the last silence
  const lastSilence = silences[silences.length - 1];
  if (totalDuration - lastSilence.end > 0.01) {
    segments.push({ start: lastSilence.end, end: totalDuration });
  }

  return segments;
}

/**
 * Gets the total duration of an audio file in seconds.
 */
async function getAudioDuration(filePath: string): Promise<number> {
  const result = await exec(`"${FFMPEG}" -i "${filePath}" -f null -`);
  const match = result.stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
  if (!match) throw new Error('Could not parse duration from ffmpeg output');
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseInt(match[3]);
  const frac = parseInt(match[4]) / Math.pow(10, match[4].length);
  return hours * 3600 + minutes * 60 + seconds + frac;
}

/**
 * Extracts a segment of audio to a new .wav file.
 */
async function extractSegment(
  inputPath: string,
  start: number,
  end: number,
  outputPath: string
): Promise<void> {
  await exec(
    `"${FFMPEG}" -i "${inputPath}" -ss ${start} -to ${end} -c copy "${outputPath}"`
  );
}

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    showUsage();
    process.exit(0);
  }

  let audioFile: string | undefined;
  let wordListFile: string | undefined;
  let outputDir = '.';
  let noiseThreshold = '-30dB';
  let minSilenceDuration = 0.3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--noise' && args[i + 1]) {
      noiseThreshold = args[i + 1];
      i++;
    } else if (args[i] === '--min-silence' && args[i + 1]) {
      minSilenceDuration = parseFloat(args[i + 1]);
      i++;
    } else if (!args[i].startsWith('-')) {
      if (!audioFile) {
        audioFile = args[i];
      } else if (!wordListFile) {
        wordListFile = args[i];
      }
    }
  }

  if (!audioFile || !wordListFile) {
    error('Error: both <audio-file> and <word-list> are required.\n');
    showUsage();
    process.exit(1);
  }

  // Resolve paths
  const absoluteAudioPath = path.resolve(audioFile);
  const absoluteWordListPath = path.resolve(wordListFile);
  const absoluteOutputDir = path.resolve(outputDir);

  // Validate inputs
  if (!fs.existsSync(absoluteAudioPath)) {
    error(`Audio file not found: ${absoluteAudioPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(absoluteWordListPath)) {
    error(`Word list not found: ${absoluteWordListPath}`);
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(absoluteOutputDir)) {
    fs.mkdirSync(absoluteOutputDir, { recursive: true });
    log(`Created output directory: ${absoluteOutputDir}`);
  }

  // Read word list
  const words = fs
    .readFileSync(absoluteWordListPath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (words.length === 0) {
    error('Word list is empty');
    process.exit(1);
  }

  log(`Word list: ${words.length} word(s)`);
  log(`Audio file: ${absoluteAudioPath}`);
  log(`Output directory: ${absoluteOutputDir}`);
  log(`Silence threshold: ${noiseThreshold}, min duration: ${minSilenceDuration}s\n`);

  // Get audio duration
  log('Getting audio duration...');
  const duration = await getAudioDuration(absoluteAudioPath);
  log(`Audio duration: ${duration.toFixed(2)}s\n`);

  // Detect silences
  log('Detecting silences...');
  const silences = await detectSilences(
    absoluteAudioPath,
    noiseThreshold,
    minSilenceDuration
  );
  log(`Found ${silences.length} silence interval(s)\n`);

  // Derive speech segments
  const segments = deriveSpeechSegments(silences, duration);
  log(`Found ${segments.length} speech segment(s)`);

  // Validate segment count matches word count
  if (segments.length !== words.length) {
    error(
      `\nMismatch: found ${segments.length} speech segments but word list has ${words.length} words.\n` +
        `This likely means:\n` +
        `  - A flub/re-say created an extra segment (${segments.length} > ${words.length})\n` +
        `  - Two words ran together without enough pause (${segments.length} < ${words.length})\n` +
        `  - The silence threshold needs adjusting (try --noise or --min-silence)\n\n` +
        `Segments detected:`
    );
    segments.forEach((seg, i) => {
      error(
        `  ${String(i + 1).padStart(4)}. ${seg.start.toFixed(3)}s - ${seg.end.toFixed(3)}s  (${(seg.end - seg.start).toFixed(3)}s)`
      );
    });
    process.exit(1);
  }

  log(`Segment count matches word count. Splitting...\n`);

  // Extract each segment with padding
  for (let i = 0; i < segments.length; i++) {
    const word = words[i];
    const seg = segments[i];
    const outputPath = path.join(absoluteOutputDir, `${word}.wav`);

    // Add padding, clamped to audio boundaries
    const paddedStart = Math.max(0, seg.start - SEGMENT_PADDING);
    const paddedEnd = Math.min(duration, seg.end + SEGMENT_PADDING);

    log(
      `  [${String(i + 1).padStart(3)}/${segments.length}] ` +
        `${paddedStart.toFixed(3)}s - ${paddedEnd.toFixed(3)}s ` +
        `(${(paddedEnd - paddedStart).toFixed(3)}s) → ${word}.wav`
    );
    await extractSegment(absoluteAudioPath, paddedStart, paddedEnd, outputPath);
  }

  log(`\nDone! Split ${segments.length} word(s) to: ${absoluteOutputDir}`);
}

main().catch((e) => {
  error(`Fatal error: ${e}`);
  process.exit(1);
});
