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

// string | null here - but we know it's a string from the above check
const FFMPEG = FFMPEGstatic as unknown as string;

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
Usage: tsx normalize-local.ts <input-directory> [-o <output-directory>]

Options:
  -o <output-directory>   Directory to write normalized files (created if needed)
                          Default: same as input directory

Examples:
  tsx normalize-local.ts .
  tsx normalize-local.ts /path/to/wavs -o /path/to/output
  tsx normalize-local.ts . -o ./normalized
`);
}

log(`FFMPEG path: ${FFMPEG}`);

/**
 * From FFMPEG's loudnorm output - loudness data on a media file
 */
interface LoudnessData {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  output_i: string;
  output_tp: string;
  output_lra: string;
  output_thresh: string;
  normalization_type: string;
  target_offset: string;
}

/**
 * Normalizes a single wav file to mp3 with loudnorm
 * Same spec as the attachment preprocessing: I=-16:TP=-1.5:LRA=11
 */
async function normalizeFile(
  inputPath: string,
  outputDir?: string
): Promise<void> {
  const tmpDir = fs.mkdtempSync(`audioNormalize-local-`);
  const baseName = path.basename(inputPath, '.wav');
  const targetDir = outputDir || path.dirname(inputPath);
  const outputPath = path.join(targetDir, `${baseName}.normalized.mp3`);

  const PADDED = path.join(tmpDir, 'padded.wav');
  const PADDED_NORMALIZED = path.join(tmpDir, 'paddedNormalized.wav');
  const NORMALIZED = path.join(tmpDir, 'normalized.mp3');

  try {
    log(`[${baseName}] Processing...`);

    // Pad with 10s of silence
    log(`[${baseName}] Padding with silence...`);
    await exec(
      `"${FFMPEG}" -i "${inputPath}" -af "adelay=10000|10000" "${PADDED}"`
    );

    // Analyze loudness
    log(`[${baseName}] Analyzing loudness...`);
    const info = await exec(
      `"${FFMPEG}" -i "${PADDED}" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -`
    );

    const data: LoudnessData = JSON.parse(
      info.stderr.substring(info.stderr.indexOf('{'))
    );

    log(
      `[${baseName}] Input loudness: I=${data.input_i} LUFS, TP=${data.input_tp} dBTP, LRA=${data.input_lra} LU`
    );

    // Normalize the padded file
    log(`[${baseName}] Normalizing...`);
    await exec(
      `"${FFMPEG}" -i "${PADDED}" -af ` +
        `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${data.input_i}:` +
        `measured_LRA=${data.input_lra}:measured_TP=${data.input_tp}:` +
        `measured_thresh=${data.input_thresh}:offset=${data.target_offset}:linear=true:` +
        `print_format=summary -ar 48k "${PADDED_NORMALIZED}"`
    );

    // Cut off the padded part and convert to mp3
    log(`[${baseName}] Cutting padding and encoding to mp3...`);
    await exec(
      `"${FFMPEG}" -i "${PADDED_NORMALIZED}" -ss 00:00:10.000 -acodec libmp3lame -b:a 192k "${NORMALIZED}"`
    );

    // Copy to output location
    fs.copyFileSync(NORMALIZED, outputPath);
    log(`[${baseName}] ✓ Saved to: ${outputPath}`);
  } catch (e) {
    error(`[${baseName}] Error: ${e}`);
    throw e;
  } finally {
    // Cleanup temp directory
    const files = fs.readdirSync(tmpDir);
    files.forEach((file) => {
      fs.unlinkSync(path.join(tmpDir, file));
    });
    fs.rmdirSync(tmpDir);
  }
}

async function main() {
  // Check FFMPEG availability
  try {
    if (!fs.existsSync(FFMPEG)) {
      error(`FFMPEG executable not found at path: ${FFMPEG}`);
      process.exit(1);
    }

    const result = await exec(`"${FFMPEG}" -version`);
    const version = result.stdout.split('\n')[0];
    log(`FFMPEG version: ${version}`);

    // Verify loudnorm filter availability
    const filters = await exec(`"${FFMPEG}" -filters | grep loudnorm`);
    if (!filters.stdout.includes('loudnorm')) {
      throw new Error('loudnorm filter not available');
    }
    log('loudnorm filter: available\n');
  } catch (e) {
    error(`FFMPEG check failed: ${e}`);
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  let targetDir = '.';
  let outputDir: string | undefined;

  // Check for help flag
  if (args.includes('-h') || args.includes('--help')) {
    showUsage();
    process.exit(0);
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' && args[i + 1]) {
      outputDir = args[i + 1];
      i++; // Skip next arg
    } else if (!args[i].startsWith('-')) {
      targetDir = args[i];
    }
  }

  const absoluteDir = path.resolve(targetDir);

  if (!fs.existsSync(absoluteDir)) {
    error(`Directory not found: ${absoluteDir}`);
    process.exit(1);
  }

  if (!fs.statSync(absoluteDir).isDirectory()) {
    error(`Not a directory: ${absoluteDir}`);
    process.exit(1);
  }

  // Create output directory if specified
  let absoluteOutputDir: string | undefined;
  if (outputDir) {
    absoluteOutputDir = path.resolve(outputDir);
    if (!fs.existsSync(absoluteOutputDir)) {
      fs.mkdirSync(absoluteOutputDir, { recursive: true });
      log(`Created output directory: ${absoluteOutputDir}`);
    } else if (!fs.statSync(absoluteOutputDir).isDirectory()) {
      error(`Output path exists but is not a directory: ${absoluteOutputDir}`);
      process.exit(1);
    }
    log(`Output directory: ${absoluteOutputDir}\n`);
  }

  log(`Scanning directory: ${absoluteDir}\n`);

  // Find all .wav files
  const files = fs.readdirSync(absoluteDir);
  const wavFiles = files.filter((f) => f.toLowerCase().endsWith('.wav'));

  if (wavFiles.length === 0) {
    log('No .wav files found in directory');
    process.exit(0);
  }

  log(`Found ${wavFiles.length} .wav file(s)\n`);

  // Process each file
  for (const wavFile of wavFiles) {
    const fullPath = path.join(absoluteDir, wavFile);
    await normalizeFile(fullPath, absoluteOutputDir);
    log(''); // blank line between files
  }

  log(`\nComplete! Processed ${wavFiles.length} file(s)`);
}

main().catch((error) => {
  error('Fatal error:', error);
  process.exit(1);
});
