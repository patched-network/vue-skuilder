import abcjs from 'abcjs';
import * as Tone from 'tone';
import { Note } from 'tonal';

// Salamander Grand Piano — production instances should self-host these samples.
// Source: https://github.com/gleitz/midi-js-soundfonts (CC BY 3.0)
const SAMPLE_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

const SAMPLE_URLS: Record<string, string> = {
  A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
  A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
  A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
  A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
  A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
  A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
  A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
  A7: 'A7.mp3', C8: 'C8.mp3',
};

let _sampler: Tone.Sampler | null = null;

async function getSampler(): Promise<Tone.Sampler> {
  if (_sampler) return _sampler;
  _sampler = new Tone.Sampler({ urls: SAMPLE_URLS, baseUrl: SAMPLE_BASE_URL }).toDestination();
  await Tone.loaded();
  return _sampler;
}

/**
 * Play an ABC notation string using Tone.js + Salamander Grand Piano samples.
 * Returns the total playback duration in milliseconds.
 */
export async function playAbc(abcString: string, qpm = 120): Promise<number> {
  await Tone.start(); // browser requires user-gesture before AudioContext resumes
  const sampler = await getSampler();

  const [visualObj] = abcjs.renderAbc('*', abcString);
  const audioTracks = visualObj.setUpAudio({ qpm });

  const startTime = Tone.now() + 0.05;

  for (const track of audioTracks.tracks) {
    for (const event of track) {
      if (event.cmd === 'note') {
        const noteName = Note.fromMidi(event.pitch);
        sampler.triggerAttackRelease(noteName, event.duration, startTime + event.start);
      }
    }
  }

  return (audioTracks.totalDuration + 0.05) * 1000;
}
