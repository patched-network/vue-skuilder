<!--

image and audio inputs are semi deprecated - not in use right now -
     superceded by the generic fillIn type that allows images and audio from the
     general mediaDragDropUploader

<template>
  <div>
    <label class="text-h5" :for="field.name">{{ title }}: </label>

    <div>
      <v-btn-toggle mandatory multiple elevation-5>
        <v-btn variant="flat">
          <v-icon :color="recording ? 'red' : null" @click="record">mic</v-icon>
        </v-btn>
        <v-btn variant="flat">
          <v-icon @click="stop">stop</v-icon>
        </v-btn>
        <v-btn variant="flat">
          <v-icon @click="play">play_arrow</v-icon>
        </v-btn>

        <v-btn variant="flat"
          ><label>
            <input
              :id="blobInputID"
              ref="inputField"
              :name="field.name"
              type="file"
              :class="validationStatus.status"
              @change="processInput"
            />
            <span>Upload</span><v-icon>folder</v-icon>
          </label>
        </v-btn>
      </v-btn-toggle>
      <div :id="waveSurferId"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { ValidatingFunction } from '@pui/base-course/Interfaces/ValidatingFunction';
import WaveSurfer from 'wavesurfer.js';
import FieldInput from '../OptionsFieldInput';
import MediaStreamRecorder from 'msr';
import { FieldDefinition } from '../../../../base-course/Interfaces/FieldDefinition';

export default defineComponent({
  extends: FieldInput,
  props: {
    field: {
      type: Object as PropType<FieldDefinition>,
      required: true,
    },
    store: {
      type: Object as PropType<object>,
      required: true,
    },
    uiValidationFunction: {
      type: Function as PropType<() => boolean>,
      required: true,
    },
    autofocus: Boolean,
  },
  data() {
    return {
      recording: false as boolean,
      blob: null as Blob | null,
      blobURL: 'f' as string,
      mediaRecorder: null as any,
      wavesurfer: null as WaveSurfer | null,
    };
  },
  computed: {
    title(): string {
      return this.field.name;
    },
    blobInputID(): string {
      return 'blobInput' + this.field.name;
    },
    waveSurferId(): string {
      return `ws-${this.field.name}`;
    },
    blobInputElement(): HTMLInputElement {
      return document.getElementById(this.blobInputID) as HTMLInputElement;
    },
  },
  methods: {
    getValidators(): ValidatingFunction[] {
      if (this.field.validator) {
        return [this.field.validator.test];
      } else {
        return [];
      }
    },
    async processInput() {
      if (this.blobInputElement.files) {
        const file = this.blobInputElement.files[0];
        console.log(`
Processing input file:
Filename: ${file.name}
File size: ${file.size}
File type: ${file.type}
`);
        this.setData({
          content_type: file.type,
          data: file.slice(),
        } as PouchDB.Core.FullAttachment);
        this.validate();
      }
    },
    blobHandler(blob: Blob | null): void {
      if (blob === null) {
        alert('nullBlob');
      } else {
        this.store[this.field.name] = {
          content_type: 'image/png',
          data: blob,
        };
        this.validate();
      }
    },
    play() {
      console.log(this.blobURL);
      this.wavesurfer?.playPause();
    },
    stop() {
      if (this.mediaRecorder) {
        this.mediaRecorder.stop();
        this.recording = false;

        setTimeout(() => {
          this.setData({
            content_type: 'audio',
            data: this.blob,
          } as PouchDB.Core.FullAttachment);
        }, 100);
        this.validate();
      }
    },
    reset() {
      this.wavesurfer?.destroy();
    },
    record() {
      this.recording = true;
      this.wavesurfer = WaveSurfer.create({
        container: `#${this.waveSurferId}`,
        barWidth: 2,
        barHeight: 1,
        barGap: 0,
      });

      const mediaConstraints = {
        audio: true,
      };

      navigator.mediaDevices
        .getUserMedia(mediaConstraints)
        .then((stream) => {
          console.log(`stream ${JSON.stringify(stream)} found...`);
          this.mediaRecorder = new MediaStreamRecorder(stream);
          this.mediaRecorder.mimeType = 'audio/webm';
          this.mediaRecorder.ondataavailable = (blob: Blob) => {
            this.blob = blob;
            this.blobURL = URL.createObjectURL(blob);
            this.wavesurfer?.load(this.blobURL);
          };
          this.mediaRecorder.start(0);
        })
        .catch((e) => {
          console.error('media error', e);
        });
    },
  },
});
</script>

<style scoped>
@import './FieldInput.css';

input[type='file'] {
  display: none;
}
</style>

-->
