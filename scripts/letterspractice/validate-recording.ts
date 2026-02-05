#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
const exec = promisify(execCallback);

import FFMPEGstatic from 'ffmpeg-static';

if (!FFMPEGstatic) {
  console.error('FFMPEGstatic executable not found');
  process.exit(1);
}

const FFMPEG = FFMPEGstatic as unknown as string;

// Thresholds
const PEAK_MIN = -12; // dBFS — below this you're too quiet
const PEAK_MAX = -3; // dBFS — above this you risk clipping
const DYNAMIC_RANGE_MIN = 30; // dB — minimum acceptable signal-to-noise
const ROOM_TONE_DURATION = 5; // seconds — assumed silence at start for noise floor measurement

interface ValidationResult {
  peakDb: number;
  rmsDb: number;
  noiseFloorDb: number;
  dynamicRangeDb: number;
  clippedSamples: number;
}

function showUsage() {
  console.log(`
Usage: tsx validate-recording.ts <audio-file> [--room-tone <seconds>]

Analyzes a raw recording to verify levels are within tolerance before processing.

Options:
  --room-tone <seconds>   Duration of silence at start for noise floor measurement
                          Default: ${ROOM_TONE_DURATION} seconds

Checks:
  - Peak level: ${PEAK_MIN} to ${PEAK_MAX} dBFS (not too quiet, not clipping)
  - Dynamic range: >${DYNAMIC_RANGE_MIN} dB (sufficient signal-to-noise)
  - Clipping: 0 samples at 0 dBFS

Examples:
  tsx validate-recording.ts session.wav
  tsx validate-recording.ts session.wav --room-tone 10
`);
}

async function getFullFileStats(
  audioPath: string
): Promise<{ peakDb: number; rmsDb: number; clippedSamples: number }> {
  // astats gives us peak, RMS, and can count clipped samples
  const result = await exec(
    `"${FFMPEG}" -i "${audioPath}" -af astats=metadata=1:measure_overall=all:measure_perchannel=none -f null - 2>&1`
  );

  const output = result.stdout + result.stderr;

  // Parse peak level (in dBFS)
  const peakMatch = output.match(/Peak level dB:\s*([-\d.]+)/);
  const peakDb = peakMatch ? parseFloat(peakMatch[1]) : NaN;

  // Parse RMS level
  const rmsMatch = output.match(/RMS level dB:\s*([-\d.]+)/);
  const rmsDb = rmsMatch ? parseFloat(rmsMatch[1]) : NaN;

  // Parse number of clipped samples (astats reports "Number of samples" at max)
  // We detect clipping by checking if peak is at or very close to 0 dBFS
  // and by looking for the clip count if available
  const clipMatch = output.match(/Number of samples clipped:\s*(\d+)/);
  const clippedSamples = clipMatch ? parseInt(clipMatch[1]) : 0;

  // Alternative clipping detection: peak at exactly 0 or very close
  const isLikelyClipped = peakDb >= -0.1;

  return {
    peakDb,
    rmsDb,
    clippedSamples: clippedSamples || (isLikelyClipped ? -1 : 0), // -1 means "likely but count unknown"
  };
}

async function getNoiseFloorStats(
  audioPath: string,
  durationSeconds: number
): Promise<{ noiseFloorDb: number }> {
  // Analyze just the first N seconds (room tone) to get noise floor
  const result = await exec(
    `"${FFMPEG}" -i "${audioPath}" -t ${durationSeconds} -af astats=metadata=1:measure_overall=all:measure_perchannel=none -f null - 2>&1`
  );

  const output = result.stdout + result.stderr;

  // RMS of the room tone section is our noise floor estimate
  const rmsMatch = output.match(/RMS level dB:\s*([-\d.]+)/);
  const noiseFloorDb = rmsMatch ? parseFloat(rmsMatch[1]) : NaN;

  return { noiseFloorDb };
}

async function validateRecording(
  audioPath: string,
  roomToneDuration: number
): Promise<ValidationResult> {
  const fullStats = await getFullFileStats(audioPath);
  const noiseStats = await getNoiseFloorStats(audioPath, roomToneDuration);

  const dynamicRangeDb = fullStats.peakDb - noiseStats.noiseFloorDb;

  return {
    peakDb: fullStats.peakDb,
    rmsDb: fullStats.rmsDb,
    noiseFloorDb: noiseStats.noiseFloorDb,
    dynamicRangeDb,
    clippedSamples: fullStats.clippedSamples,
  };
}

function formatCheck(
  label: string,
  value: number | string,
  pass: boolean,
  target: string
): string {
  const icon = pass ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  const valueStr = typeof value === 'number' ? value.toFixed(1) : value;
  return `${label.padEnd(16)} ${valueStr.padStart(10)}  ${icon}  (target: ${target})`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help') || args.length === 0) {
    showUsage();
    process.exit(0);
  }

  let audioFile: string | undefined;
  let roomToneDuration = ROOM_TONE_DURATION;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--room-tone' && args[i + 1]) {
      roomToneDuration = parseFloat(args[i + 1]);
      i++;
    } else if (!args[i].startsWith('-')) {
      audioFile = args[i];
    }
  }

  if (!audioFile) {
    console.error('Error: audio file is required.\n');
    showUsage();
    process.exit(1);
  }

  const absolutePath = path.resolve(audioFile);
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`\nValidating: ${path.basename(absolutePath)}`);
  console.log(`Room tone duration: ${roomToneDuration}s\n`);

  const result = await validateRecording(absolutePath, roomToneDuration);

  // Evaluate pass/fail
  const peakPass = result.peakDb >= PEAK_MIN && result.peakDb <= PEAK_MAX;
  const dynamicPass = result.dynamicRangeDb >= DYNAMIC_RANGE_MIN;
  const clipPass = result.clippedSamples === 0;

  console.log(
    formatCheck('Peak', `${result.peakDb.toFixed(1)} dBFS`, peakPass, `${PEAK_MIN} to ${PEAK_MAX}`)
  );
  console.log(formatCheck('RMS', `${result.rmsDb.toFixed(1)} dB`, true, 'info only'));
  console.log(
    formatCheck(
      'Noise floor',
      `${result.noiseFloorDb.toFixed(1)} dB`,
      true,
      `first ${roomToneDuration}s`
    )
  );
  console.log(
    formatCheck(
      'Dynamic range',
      `${result.dynamicRangeDb.toFixed(1)} dB`,
      dynamicPass,
      `>${DYNAMIC_RANGE_MIN}`
    )
  );

  const clipDisplay =
    result.clippedSamples === -1 ? 'likely (peak ~0dB)' : String(result.clippedSamples);
  console.log(formatCheck('Clipped samples', clipDisplay, clipPass, '0'));

  console.log('');

  // Overall verdict
  const allPass = peakPass && dynamicPass && clipPass;
  if (allPass) {
    console.log('\x1b[32mRecording levels OK — proceed with processing.\x1b[0m\n');
  } else {
    console.log('\x1b[31mRecording levels outside tolerance — review before processing.\x1b[0m');
    if (!peakPass && result.peakDb < PEAK_MIN) {
      console.log('  - Too quiet: increase mic gain');
    }
    if (!peakPass && result.peakDb > PEAK_MAX) {
      console.log('  - Too hot: decrease mic gain');
    }
    if (!dynamicPass) {
      console.log('  - Poor signal-to-noise: check mic placement, reduce ambient noise');
    }
    if (!clipPass) {
      console.log('  - Clipping detected: decrease mic gain and re-record');
    }
    console.log('');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`Fatal error: ${e}`);
  process.exit(1);
});
