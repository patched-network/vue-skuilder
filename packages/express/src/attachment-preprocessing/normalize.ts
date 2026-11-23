import fs from 'fs';
import logger from '../logger.js';
import { promisify } from 'util';
import { execFile as execFileCallback } from 'child_process';
import FFMPEGstatic from 'ffmpeg-static';

const execFile = promisify(execFileCallback);

// Nothing here runs at import time: the CLI loads this module (via express) for commands that
// never touch audio, and an import-time ffmpeg check printed noise and could reject unhandled.
let ffmpegReady: Promise<string> | null = null;

/**
 * Resolves to the ffmpeg binary path, verifying it (once) on first use.
 */
function getFFMPEG(): Promise<string> {
  if (!ffmpegReady) {
    ffmpegReady = checkFFMPEG().catch((e) => {
      ffmpegReady = null; // allow a retry on the next call
      throw e;
    });
  }
  return ffmpegReady;
}

async function checkFFMPEG(): Promise<string> {
  // string | null in the types
  const FFMPEG = FFMPEGstatic as unknown as string | null;
  if (!FFMPEG || !fs.existsSync(FFMPEG)) {
    const e = `[normalize] FFMPEG executable not found at path: ${FFMPEG}`;
    logger.error(e);
    throw new Error(e);
  }

  const result = await execFile(FFMPEG, ['-version']);
  logger.info(`[normalize] FFMPEG ${FFMPEG}: ${result.stdout.split('\n')[0]}`);

  const filters = await execFile(FFMPEG, ['-hide_banner', '-filters']);
  if (!filters.stdout.includes('loudnorm')) {
    const e = '[normalize] FFMPEG loudnorm filter not available';
    logger.error(e);
    throw new Error(e);
  }
  return FFMPEG;
}

/**
 * From FFMPEG's loudnorm output - loudness data on a media file
 */
interface LoudnessData {
  // these are numbers, but will be parsed as strings
  input_i: string; //number;
  input_tp: string; //number;
  input_lra: string; //number;
  input_thresh: string; //number;
  output_i: string; //number;
  output_tp: string; //number;
  output_lra: string; //number;
  output_thresh: string; //number;
  normalization_type: string; // this one is actually a string
  target_offset: string; //number;
}

/**
 * Returns normalized, base-64 encoded mp3
 *
 * @param fileData the base-64 encoded mp3 data from couchdb
 */
export async function normalize(fileData: string): Promise<string> {
  const encoding = 'base64';
  const tmpDir = fs.mkdtempSync(`audioNormalize-${encoding}-`);
  const fileName = tmpDir + '/file.mp3';

  fs.writeFileSync(fileName, fileData, {
    encoding,
  });

  const ext = '.' + fileName.split('.')[1];

  const PADDED = tmpDir + '/padded' + ext;
  const PADDED_NORMALIZED = tmpDir + '/paddedNormalized' + ext;
  const NORMALIZED = tmpDir + '/normalized' + ext;

  try {
    const FFMPEG = await getFFMPEG();
    // execFile, not exec: arguments go to ffmpeg directly, with no shell to split or interpret them
    // elongate
    await execFile(FFMPEG, [
      '-i',
      fileName,
      '-af',
      'adelay=10000|10000',
      PADDED,
    ]);
    const info = await execFile(FFMPEG, [
      '-i',
      PADDED,
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ]);
    const data: LoudnessData = JSON.parse(
      info.stderr.substring(info.stderr.indexOf('{'))
    );
    // normalize the elongated file
    await execFile(FFMPEG, [
      '-i',
      PADDED,
      '-af',
      `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${data.input_i}:` +
        `measured_LRA=${data.input_lra}:measured_TP=${data.input_tp}:` +
        `measured_thresh=${data.input_thresh}:offset=${data.target_offset}:linear=true:` +
        `print_format=summary`,
      '-ar',
      '48k',
      PADDED_NORMALIZED,
    ]);
    // cut off the elongated part
    await execFile(FFMPEG, [
      '-i',
      PADDED_NORMALIZED,
      '-ss',
      '00:00:10.000',
      '-acodec',
      'copy',
      NORMALIZED,
    ]);
    const ret = fs.readFileSync(NORMALIZED, {
      encoding,
    });
    return ret;
  } catch (e) {
    logger.error(e);
    throw e;
  } finally {
    const files = fs.readdirSync(tmpDir);
    files.forEach((file) => {
      fs.unlinkSync(tmpDir + '/' + file);
    });
    fs.rmdirSync(tmpDir);
  }
}
