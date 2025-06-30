<template>
  <div class="mr-2 mb-2">
    <v-label class="text-h5">Add media:</v-label>
    <div
      class="drop-zone"
      :class="{ 'drop-zone--over': isDragging }"
      @drop="dropHandler"
      @dragover.prevent="dragOverHandler"
      @dragenter.prevent="dragEnterHandler"
      @dragleave.prevent="dragLeaveHandler"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*,audio/*"
        multiple
        style="display: none"
        @change="handleFileInput"
      />
      <!-- <template> -->
      <div v-for="(item, index) in mediaItems" :key="index" class="media-item">
        <template v-if="item.type === 'image'">
          <img :src="item.thumbnailUrl" alt="Uploaded image thumbnail" class="thumbnail" />
        </template>
        <template v-else-if="item.type === 'audio'">
          <audio controls :src="item.url"></audio>
        </template>
        <v-btn size="small" @click="removeMedia(index)">Remove</v-btn>
      </div>
      <!-- <template> -->
      Drop image or audio files here...
      <v-btn @click="triggerFileInput">Or Click to Upload</v-btn>
      <!-- </template> -->
      <!-- <v-btn @click="addMoreMedia">Add More Media</v-btn> -->
      <!-- </template> -->
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FieldInput from './OptionsFieldInput';
import { Status } from '@vue-skuilder/common';
import { FieldInputSetupReturn } from './OptionsFieldInput';

export interface MediaItem {
  type: 'image' | 'audio';
  file: File;
  url: string;
  thumbnailUrl?: string;
}

export default defineComponent({
  name: 'MediaDragDropUploader',
  extends: FieldInput,

  setup(props, ctx) {
    // Get the parent setup result
    const parentSetup = FieldInput.setup?.(props, ctx) as FieldInputSetupReturn;

    // Now you can access fieldStore and other parent setup properties
    const { fieldStore } = parentSetup;

    // Return both parent and child setup properties
    return {
      ...parentSetup,
      fieldStore,
      // Add any additional setup properties specific to this component
    };
  },

  data() {
    return {
      isDragging: false,
      mediaItems: [] as MediaItem[],
    };
  },

  computed: {
    hasMedia(): boolean {
      return this.mediaItems.length > 0;
    },
  },

  created() {
    // this.validate();
  },

  methods: {
    dragOverHandler(event: DragEvent) {
      event.preventDefault();
    },

    dragEnterHandler(event: DragEvent) {
      event.preventDefault();
      this.isDragging = true;
    },

    dragLeaveHandler(event: DragEvent) {
      event.preventDefault();
      this.isDragging = false;
    },

    dropHandler(event: DragEvent) {
      event.preventDefault();
      this.isDragging = false;
      const files = event.dataTransfer?.files;
      if (files) {
        this.processFiles(files);
      }
    },

    triggerFileInput() {
      (this.$refs.fileInput as HTMLInputElement).click();
    },

    handleFileInput(event: Event) {
      const files = (event.target as HTMLInputElement).files;
      if (files) {
        this.processFiles(files);
      }
    },

    processFiles(files: FileList) {
      Array.from(files).forEach((file) => {
        this.addMediaItem(file);
      });
      this.updateStore();
    },

    addMediaItem(file: File) {
      const type = file.type.startsWith('image/') ? 'image' : 'audio';
      const item: MediaItem = {
        type,
        file,
        url: URL.createObjectURL(file),
      };

      if (type === 'image') {
        this.createThumbnail(file).then((thumbnailUrl) => {
          item.thumbnailUrl = thumbnailUrl;
          this.$nextTick(() => {
            this.$forceUpdate();
          });
        });
      }

      this.mediaItems.push(item);
    },

    async createThumbnail(file: File): Promise<string> {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          resolve(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    },

    removeMedia(index: number) {
      URL.revokeObjectURL(this.mediaItems[index].url);
      this.mediaItems.splice(index, 1);
      this.updateStore();
    },

    clearData() {
      this.mediaItems.forEach((item) => {
        URL.revokeObjectURL(item.url);
      });
      this.mediaItems = [];
      this.updateStore();
      // this.validate();
    },

    addMoreMedia() {
      console.log('addMoreMedia');
      this.triggerFileInput();
    },

    updateStore() {
      // for (let i = 1; i <= 10; i++) {
      //   delete this.dataInputForm.dataInputForm[`image-${i}`];
      //   delete this.dataInputForm.dataInputForm[`audio-${i}`];
      // }

      let imageCount = 0;
      let audioCount = 0;
      this.mediaItems.forEach((item) => {
        if (item.type === 'image') {
          imageCount++;
          this.fieldStore.setMedia(`image-${imageCount}`, {
            content_type: item.file.type,
            data: item.file,
          });
        } else if (item.type === 'audio') {
          audioCount++;
          this.fieldStore.setMedia(`audio-${audioCount}`, {
            content_type: item.file.type,
            data: item.file,
          });
        }
      });
      // this.validate();
    },

    getValidators() {
      return [
        () => ({
          status: this.mediaItems.length > 0 ? Status.ok : Status.error,
          msg: this.mediaItems.length > 0 ? '' : 'At least one media item is required',
        }),
      ];
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

.drop-zone--over {
  border-color: #000;
  background-color: rgba(0, 0, 0, 0.1);
}

.thumbnail {
  max-width: 100px;
  max-height: 100px;
  margin-right: 10px;
}

.media-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
</style>
