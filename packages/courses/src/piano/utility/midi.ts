// eslint-disable-next-line
/// <reference types="webmidi" />
import webmidi, {
  WebMidi,
  Input,
  Output,
  IEventNote,
  InputEventNoteoff,
  InputEventNoteon,
} from 'webmidi';
import { Note, Interval } from '@tonaljs/tonal';
import { alertUser } from '@vue-skuilder/common-ui';
import { Status } from '@vue-skuilder/common';
import { User } from '@vue-skuilder/db';
// import Navigator from '@types/webmidi';

export interface NoteEvent {
  note: IEventNote;
  velocity: number;
  timestamp: number;
  type: 'noteon' | 'noteoff';
}

function transpose(note: NoteEvent, semitones: number): NoteEvent {
  const ret: NoteEvent = { ...note };
  const transposedNote = Note.transpose(
    note.note.name + note.note.octave,
    Interval.fromSemitones(semitones)
  );

  ret.note = {
    name: Note.pitchClass(transposedNote),
    number: note.note.number + semitones,
    octave: Note.octave(transposedNote)!,
  };
  return ret;
}

export function transposeSyllableSeq(notes: NoteEvent[], semitones: number) {
  return notes.map((n) => transpose(n, semitones));
}

export function eventsToSyllableSequence(midi: NoteEvent[]): SyllableSequence {
  const syllables: Syllable[] = [];
  midi = midi.filter((e) => e.type === 'noteon').sort((a, b) => a.timestamp - b.timestamp);

  for (let chordSize = 10; chordSize > 0; chordSize--) {
    for (let i = 0; i < midi.length - chordSize + 1; i++) {
      try {
        syllables.push(new Syllable(midi.slice(i, i + chordSize)));
        // if a chordSized syllable has been created, remove these notes from
        // the 'to be parsed' pile
        midi.splice(i, chordSize);
        // and reset the 'parse from the beginning' index so that
        // the new midi[0] is not passed over
        i = -1;
      } catch {
        // console.log(`awef`);
      }
    }
  }

  return new SyllableSequence(syllables);
}

export class SyllableSequence {
  syllables: Syllable[];
  rootNote: IEventNote;

  append(e: NoteEvent) {
    if (this.syllables.length) {
      try {
        const amendedLastSyllable = new Syllable(
          this.syllables[this.syllables.length - 1].notes
            .map((note) => {
              return {
                note: note.note,
                timestamp: note.timestamp,
                type: note.type,
                velocity: note.velocity,
              };
            })
            .concat(e)
        );
        this.syllables.splice(this.syllables.length - 1, 1, amendedLastSyllable);
      } catch {
        this.syllables.push(new Syllable([e]));
      }
    } else {
      this.syllables.push(new Syllable([e]));
      this.rootNote = e.note;
    }
  }

  /**
   *
   */
  constructor(syllables: Syllable[]) {
    if (syllables.length > 0) {
      this.syllables = syllables.sort((a, b) => {
        return a.timestamp - b.timestamp;
      });
      this.rootNote = this.syllables[0].notes.reduce((lowest, current) => {
        return current.note.number < lowest.note.number ? current : lowest;
      }).note;
    } else {
      this.syllables = [];
      this.rootNote = {
        name: 'C',
        octave: 4,
        number: 0,
      };
    }
  }

  public grade(answer: SyllableSequence): SyllableSequence {
    const ret: Syllable[] = [];

    for (let i = 0; i < this.syllables.length; i++) {
      ret.push(this.syllables[i].grade(answer.syllables[i]));
    }

    return new SyllableSequence(ret);
  }

  public toString(): string {
    let ret = '';
    this.syllables.forEach((s, i) => {
      ret += `Syllable ${i + 1}: {\n`;
      s.notes.forEach((n) => {
        ret += `\t${n.note.name}\t${n.note.number}\t${n.timestamp} ${
          n.isCorrect ? '' : '(incorrect)'
        } ${n.isMissing ? '(missing)' : ''}\n`;
      });
      ret += `} - ${s.timestamp}, correct: ${s.isCorrect}\n`;
    });
    return ret;
  }

  public isCorrect(): boolean {
    let ret = true;
    this.syllables.forEach((s) => {
      if (s.isCorrect === false) {
        ret = false;
      } else {
        s.notes.forEach((n) => {
          if (n.isCorrect === false) {
            ret = false;
          }
        });
      }
    });
    return ret;
  }
}

class Syllable {
  notes: (NoteEvent & {
    isCorrect: boolean;
    isMissing: boolean;
  })[];
  isCorrect: boolean | undefined;

  get timestamp(): number {
    let timestamp = 0;
    this.notes.forEach((n) => {
      if (n.timestamp === 0) {
        return 0;
      } else {
        timestamp += n.timestamp;
      }
    });
    timestamp /= this.notes.length;
    return timestamp;
  }

  /**
   *
   */
  constructor(notes: NoteEvent[]) {
    notes = notes.filter((note) => {
      return note.type === 'noteon';
    });

    const minTimestamp = notes.reduce((min, current) => {
      if (min.timestamp < current.timestamp) {
        return min;
      } else {
        return current;
      }
    });
    const maxTimestamp = notes.reduce((max, current) => {
      if (max.timestamp > current.timestamp) {
        return max;
      } else {
        return current;
      }
    });
    const timespan = maxTimestamp.timestamp - minTimestamp.timestamp;

    if (Syllable.gracePeriod(notes.length) < timespan) {
      throw new Error(`Notes ${notes.toString()} are not close enough together to be a syllable`);
    } else {
      this.notes = notes
        .map((note) => {
          return {
            ...note,
            isCorrect: true,
            isMissing: false,
          };
        })
        .sort((a, b) => {
          return a.note.number - b.note.number;
        });
    }
  }

  /**
   * Returns the size of a timespan (in ms) that
   * a n-note chord must be contained within
   * @param n number of notes
   */
  private static gracePeriod(n: number): number {
    const sequentialEventsLowerBound = 12; // milliseconds
    return 1.3 * sequentialEventsLowerBound * n;
  }

  public grade(answer: Syllable /*, refNote?: IEventNote */): Syllable {
    // const ref =
    //   refNote ||
    //   this.notes.sort((a, b) => {
    //     return a.note.number - b.note.number;
    //   })[0];

    if (this.notes.length !== answer.notes.length) {
      answer.isCorrect = false;
    }

    answer.notes.forEach((studentNote) => {
      let fNote = Note.fromMidi(studentNote.note.number);
      let sNote = Note.fromMidiSharps(studentNote.note.number);

      fNote = Note.pitchClass(fNote);
      sNote = Note.pitchClass(sNote);

      studentNote.isCorrect =
        this.notes.filter(
          (note) =>
            Note.chroma(fNote) === Note.chroma(note.note.name) ||
            Note.chroma(sNote) === Note.chroma(note.note.name)
        ).length >= 1;
      if (!studentNote.isCorrect) {
        answer.isCorrect = false;
      }
    });

    this.notes.forEach((note) => {
      let fNote = Note.fromMidi(note.note.number);
      // let sNote = Note.fromMidiSharps(note.note.number);

      fNote = Note.pitchClass(fNote);
      // sNote = Note.pitchClass(sNote);

      if (
        !answer.notes.some(
          (studentNote) => Note.chroma(studentNote.note.name) === Note.chroma(fNote)
        )
      ) {
        answer.notes.push({
          ...note,
          isMissing: true,
          isCorrect: false,
        });
      }
    });

    return answer;
  }
}

class SkMidi {
  private static _instance: SkMidi;

  /**
   * OFFSET is used to push all playback events (noteon, note off)
   * forward by OFFSET milliseconds. This is to prevent a
   * 'stutter' effect between the first and second syllables
   * when the time between them is small. (noteon at ~0 ms suffers
   * from a latency effect, while other timestamps don't).
   */
  static readonly OFFSET: number = 5;

  public recording: NoteEvent[] = [];

  private webmidi: WebMidi = webmidi;
  private input: Input | undefined;
  private output: Output | undefined;
  private _noteonListeners: ((e: InputEventNoteon) => void)[] = [];
  private _noteoffListeners: ((e: InputEventNoteoff) => void)[] = [];

  private static _initializedWithUserConfig = false;

  private midiAccess: WebMidi.MIDIAccess | undefined;

  private _state: 'nodevice' | 'notsupported' | 'ready' | 'initializing' = 'initializing';
  public get state() {
    return this._state;
  }

  private _userLookup: (() => Promise<User>) | null;

  private constructor(userLookup?: () => Promise<User>) {
    this._userLookup = userLookup ?? null;
  }

  private async init(): Promise<boolean> {
    if (!this.midiAccess) {
      try {
        navigator.requestMIDIAccess().then((access) => {
          this.midiAccess = access;
          this.midiAccess.onstatechange = (e) => {
            alertUser({
              text: `Midi device ${e.port.name} is ${e.port.state}`,
              status: e.port.state === 'connected' ? Status.ok : Status.error,
            });
          };
        });
      } catch (e) {
        console.log(`Webmidi not enabled: ${e}`);
        this._state = 'notsupported';
      }
    }

    try {
      this.webmidi.disable();
    } catch (e) {
      console.log(`Webmidi not enabled: ${e}`);
      this._state = 'notsupported';
    }

    return new Promise<boolean>((resolve, reject) => {
      this.webmidi.enable(async (err) => {
        if (err) {
          this._state = 'notsupported';
          console.log(`Webmidi not enabled: ${err}`);
          // setTimeout(this.init, 2000);
          reject(err);
        } else {
          console.log(`Webmidi enabled`);

          // Viewing available inputs and outputs
          console.log(`Inputs: ${JSON.stringify(this.webmidi.inputs)}`);
          console.log(`Outputs: ${JSON.stringify(this.webmidi.outputs)}`);

          // set defaults first
          this.output = this.webmidi.outputs[0];
          this.input = this.webmidi.inputs[0];

          // but try to load configurfed devices
          if (!SkMidi._initializedWithUserConfig) {
            await this.loadUserConfiguration();
            SkMidi._initializedWithUserConfig = true;
          }

          if (this.input && this.output) {
            console.log('midi init state: ready');
            this._state = 'ready';
            this.attachListeners();
          } else {
            console.log('midi init state: nodevice');

            this._state = 'nodevice';
          }

          resolve(true);
        }
      });
    });
  }

  private async loadUserConfiguration(): Promise<void> {
    try {
      if (!this._userLookup) {
        console.log('User lookup function not provided - using default MIDI configuration');
        return;
      }

      const user = await this._userLookup();

      if (!user) {
        console.log('No user found, using default MIDI configuration');
        return;
      }

      // Get all course settings that might have MIDI configurations
      const courses = await user.getActiveCourses();
      for (const course of courses) {
        const settings = await user.getCourseSettings(course.courseID);
        if (settings?.midiinput || settings?.midioutput) {
          // We found MIDI settings, use the first valid ones
          if (settings.midiinput && this.webmidi.getInputById(settings.midiinput.toString())) {
            this.selectInput(settings.midiinput.toString());
            console.log(`Loaded saved MIDI input: ${settings.midiinput}`);
          }

          if (settings.midioutput && this.webmidi.getOutputById(settings.midioutput.toString())) {
            this.selectOutput(settings.midioutput.toString());
            console.log(`Loaded saved MIDI output: ${settings.midioutput}`);
          }

          // Once we've found and applied settings, we can stop searching
          break;
        }
      }
    } catch (error) {
      console.error('Failed to load user MIDI configuration:', error);
    }
  }

  public setStateChangeListener(f: () => void) {
    if (!this.midiAccess) {
      try {
        navigator.requestMIDIAccess().then((access) => {
          this.midiAccess = access;
          this.midiAccess.onstatechange = (e) => {
            this.init().then(() => {
              console.log(`Midi state: ${this.state}`);
              f();
            });
            alertUser({
              text: `Midi device ${e.port.name} is ${e.port.state}`,
              status: e.port.state === 'connected' ? Status.ok : Status.error,
            });
          };
        });
      } catch (e) {
        console.log(`Webmidi not enabled: ${e}`);
        this._state = 'notsupported';
      }
    } else {
      this.midiAccess.onstatechange = (e) => {
        this.init().then(() => {
          console.log(`Midi state: ${this.state}`);
          f();
        });
        alertUser({
          text: `Midi device ${e.port.name} is ${e.port.state}`,
          status: e.port.state === 'connected' ? Status.ok : Status.error,
        });
      };
    }
  }

  private attachListeners() {
    if (this.input) {
      this._noteonListeners.forEach((f) => {
        this.input?.on('noteon', 'all', f);
      });
      this._noteoffListeners.forEach((f) => {
        this.input?.on('noteoff', 'all', f);
      });
    }
  }

  public get hasRecording(): boolean {
    return this.record.length > 0;
  }

  public get configuredInput(): string {
    if (this.input) {
      return `${this.input.manufacturer}: ${this.input.name}`;
    } else {
      return '(Not Sure!)';
    }
  }

  public eraseRecording() {
    this.recording = [];
  }

  public stopRecording() {
    this.input?.removeListener();
  }

  public record() {
    let initTimestamp: number = 0;

    if (this.input === undefined) {
      throw new Error(`Midi input not configured!`);
    }
    if (this.input.connection === 'open') {
      // remove previously attached listeners
      this.stopRecording();
      // clear previously recorded data
      this.eraseRecording();

      this.input.on('noteon', 'all', (e) => {
        if (this.recording.length === 0) {
          initTimestamp = e.timestamp;
        }
        // console.log(`${e.note.name} - time: ${e.timestamp}`);
        this.recording.push({
          note: e.note,
          type: e.type,
          velocity: e.velocity,
          timestamp: e.timestamp - initTimestamp,
        });
      });
      this.input.on('noteoff', 'all', (e) => {
        if (this.recording.length === 0) {
          initTimestamp = e.timestamp;
        }
        // console.log(e.note.name + ' off');
        this.recording.push({
          note: e.note,
          velocity: e.velocity,
          type: e.type,
          timestamp: e.timestamp - initTimestamp,
        });
      });
    }
  }

  public addNoteonListenter(f: (e: InputEventNoteon) => void) {
    this._noteonListeners.push(f);
    if (this.input) {
      this.input.on('noteon', 'all', f);
    }
  }
  public addNoteoffListenter(f: (e: InputEventNoteoff) => void) {
    this._noteoffListeners.push(f);
    if (this.input) {
      this.input.on('noteoff', 'all', f);
    }
  }

  public play(recording?: NoteEvent[]) {
    let playbackData: NoteEvent[] = recording ? recording : this.recording;
    playbackData = playbackData.map((e) => {
      return {
        ...e,
        timestamp: e.timestamp + SkMidi.OFFSET,
      };
    });

    playbackData.forEach((e) => {
      if (e.type === 'noteon') {
        this.output?.playNote(e.note.name + e.note.octave, 1, {
          velocity: e.velocity,
          time: `+${e.timestamp}`,
          rawVelocity: false,
        });
      } else {
        this.output?.stopNote(e.note.name + e.note.octave, 1, {
          velocity: e.velocity,
          time: `+${e.timestamp}`,
          rawVelocity: false,
        });
      }
    });
  }

  public static async instance(): Promise<SkMidi> {
    if (SkMidi._instance) {
      return SkMidi._instance;
    } else {
      console.log(`Buzz, whirr, Midi instance factory is at work`);
      SkMidi._instance = new SkMidi();
      await SkMidi._instance.init();
      return SkMidi._instance;
    }
  }

  public get inputs(): Input[] {
    return this.webmidi.inputs;
  }
  public get outputs(): Output[] {
    return this.webmidi.outputs;
  }

  public selectInput(id: string): void {
    if (this.webmidi.getInputById(id) !== false) {
      this.input = this.webmidi.getInputById(id) as Input;
    } else if (this.webmidi.getInputByName(id) !== false) {
      this.input = this.webmidi.getInputByName(id) as Input;
    }
  }

  public selectOutput(id: string): void {
    if (this.webmidi.getOutputById(id) !== false) {
      this.output = this.webmidi.getOutputById(id) as Output;
    } else if (this.webmidi.getOutputByName(id) !== false) {
      this.output = this.webmidi.getOutputByName(id) as Output;
    }
  }
}

export default SkMidi;
