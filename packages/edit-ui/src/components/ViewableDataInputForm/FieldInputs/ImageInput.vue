<!--

image and audio inputs are semi deprecated - not in use right now -
     superceded by the generic fillIn type that allows images and audio from the
     general mediaDragDropUploader

<template>
  <div>
    <label :for="field.name">{{ field.name }}: </label>
    <div
      class="drop-zone"
      :class="{ 'drop-zone--over': isDragging }"
      @drop="dropHandler"
      @dragover.prevent="dragOverHandler"
      @dragenter.prevent="dragEnterHandler"
      @dragleave.prevent="dragLeaveHandler"
    >
      <template v-if="!thumbnailUrl">
        Drop a file here...
        <input
          :id="blobInputID"
          ref="inputField"
          :name="field.name"
          type="file"
          :class="validationStatus.status"
          accept="image/*"
          @change="processInput"
          @click.stop
        />
      </template>
      <template v-else>
        <img :src="thumbnailUrl" alt="Uploaded image thumbnail" class="thumbnail" />
        <button @click="clearImage">Clear Image</button>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ValidatingFunction } from '@vue-skuilder/common';
import FieldInput from '../OptionsFieldInput';

// [ ] delete this file ? (Jan 6, 2025)

export default defineComponent({
  name: 'ImageInput',
  extends: FieldInput,

  data() {
    return {
      isDragging: false,
      dragCounter: 0,
      thumbnailUrl: null as string | null,
    };
  },

  computed: {
    blobInputID(): string {
      return 'blobInput' + this.field.name;
    },

    blobInputElement(): HTMLInputElement {
      return document.getElementById(this.blobInputID) as HTMLInputElement;
    },
  },

  methods: {
    dragOverHandler(ev: DragEvent) {
      ev.preventDefault();
    },

    dragEnterHandler(ev: DragEvent) {
      ev.preventDefault();
      this.dragCounter++;
      this.isDragging = true;
    },

    dragLeaveHandler(ev: DragEvent) {
      ev.preventDefault();
      this.dragCounter--;
      if (this.dragCounter === 0) {
        this.isDragging = false;
      }
    },

    dropHandler(ev: DragEvent) {
      if (ev) {
        ev.preventDefault();

        this.isDragging = false;
        this.dragCounter = 0;

        if (ev.dataTransfer?.files.length) {
          const file = ev.dataTransfer.files[0];
          this.processDroppedFile(file);
        } else if (ev.dataTransfer?.types.includes('text/plain') || ev.dataTransfer?.types.includes('text/uri-list')) {
          const imgURL = ev.dataTransfer.getData('text');
          this.fetchImg(imgURL);
          console.log(`Dropped URL: ${imgURL}`);
        } else {
          console.error('Unsupported drop type');
        }
      } else {
        console.error('dropHandler triggered with no event');
      }
    },

    processDroppedFile(file: File) {
      console.log(`
Processing dropped file:

Filename: ${file.name}
File size: ${file.size}
File type: ${file.type}
`);
      this.setData({
        content_type: file.type,
        data: file.slice(),
      } as PouchDB.Core.FullAttachment);
      this.createThumbnail(file);
      this.validate();
    },

    async fetchImg(url: string) {
      try {
        const img = await fetch(url, {
          mode: 'no-cors',
          'content-type': 'image',
        } as any);
        const blob = await (img.body as any).blob();

        const file = new File([blob], 'dropped_image', { type: blob.type });
        this.setData({
          content_type: file.type,
          data: file.slice(),
        });
        this.createThumbnail(file);
        this.validate();
      } catch (error) {
        console.error('Error fetching image:', error);
      }
    },

    dragHandler(ev: DragEvent) {
      console.log(`Dragging... ${JSON.stringify(ev)}`);
    },

    getValidators(): ValidatingFunction[] {
      if (this.field.validator) {
        return [this.field.validator.test];
      } else {
        return [];
      }
    },

    removeDragData(ev: DragEvent) {
      if (ev.dataTransfer!.items) {
        ev.dataTransfer!.items.clear();
      } else {
        ev.dataTransfer!.clearData();
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
        this.createThumbnail(file);
        this.validate();
      }
    },

    createThumbnail(file: File) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.thumbnailUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },

    clearImage() {
      this.thumbnailUrl = null;
      this.setData(null);
      this.validate();
      if (this.$refs.inputField) {
        (this.$refs.inputField as HTMLInputElement).value = '';
      }
    },
  },
});
</script>

<style scoped>
@import './FieldInput.css';

.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 4px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

input[type='file'] {
  box-shadow: none !important; /* uncertain where this is coming from */
}

.drop-zone--over {
  border-color: #000;
  background-color: rgba(0, 0, 0, 0.1);
}

.thumbnail {
  max-width: 100%;
  max-height: 200px;
  margin-bottom: 10px;
}
</style>

-->
