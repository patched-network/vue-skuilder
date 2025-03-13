<template>
  <div ref="containerRef" class="multipleChoice">
    <MultipleChoiceOption
      v-for="(choice, i) in choiceList"
      :key="i"
      :content="choice"
      :selected="choiceList.indexOf(choice) === currentSelection"
      :number="choiceList.indexOf(choice)"
      :set-selection="setSelection"
      :submit="forwardSelection"
      :marked-wrong="choiceIsWrong(choice)"
    />
  </div>
</template>

<script lang="ts">
import UserInput from '@/base-course/Components/UserInput/OptionsUserInput';
import MultipleChoiceOption from './MultipleChoiceOption.vue';
import { Answer } from '@vue-skuilder/common';
import { defineComponent, PropType } from 'vue';
import { SkldrMouseTrap } from '@vue-skuilder/common-ui';

export interface RadioSelectAnswer extends Answer {
  choiceList: string[];
  selection: number;
}

export default defineComponent({
  name: 'RadioSelect',
  components: {
    MultipleChoiceOption,
  },
  extends: UserInput,
  props: {
    choiceList: {
      type: Array as PropType<string[]>,
      required: true,
    },
  },
  data() {
    return {
      currentSelection: -1,
      incorrectSelections: [] as number[],
      containerRef: null as null | HTMLElement,
    };
  },
  watch: {
    choiceList: {
      immediate: true,
      handler(newList) {
        if (newList?.length) {
          this.bindKeys();
        }
      },
    },
  },
  mounted() {
    if (this.containerRef) {
      this.containerRef.focus();
    }
  },
  unmounted() {
    this.unbindKeys();
  },
  methods: {
    forwardSelection(): void {
      if (this.choiceIsWrong(this.choiceList[this.currentSelection])) {
        return;
      } else if (this.currentSelection !== -1) {
        const ans: RadioSelectAnswer = {
          choiceList: this.choiceList,
          selection: this.currentSelection,
        };
        const record = this.submitAnswer(ans);

        if (!record.isCorrect) {
          this.incorrectSelections.push(this.currentSelection);
        }
      }
    },
    setSelection(selection: number): void {
      if (selection < this.choiceList.length) {
        this.currentSelection = selection;
      }
    },
    incrementSelection(): void {
      if (this.currentSelection === -1) {
        this.currentSelection = Math.ceil(this.choiceList.length / 2);
      } else {
        this.currentSelection = Math.min(this.choiceList.length - 1, this.currentSelection + 1);
      }
    },
    decrementSelection(): void {
      if (this.currentSelection === -1) {
        this.currentSelection = Math.floor(this.choiceList.length / 2 - 1);
      } else {
        this.currentSelection = Math.max(0, this.currentSelection - 1);
      }
    },
    choiceIsWrong(choice: string): boolean {
      let ret = false;
      this.incorrectSelections.forEach((sel) => {
        if (this.choiceList[sel] === choice) {
          ret = true;
        }
      });
      return ret;
    },
    bindKeys() {
      SkldrMouseTrap.bind([
        {
          hotkey: 'left',
          callback: this.decrementSelection,
          command: 'Move selection left',
        },
        {
          hotkey: 'right',
          callback: this.incrementSelection,
          command: 'Move selection right',
        },
        {
          hotkey: 'enter',
          callback: this.forwardSelection,
          command: 'Submit selection',
        },
        // Add number key bindings
        ...Array.from({ length: this.choiceList.length }, (_, i) => ({
          hotkey: (i + 1).toString(),
          callback: () => this.setSelection(i),
          command: `Select option ${i + 1}`,
        })),
      ]);
    },

    unbindKeys() {
      // this.MouseTrap.unbind('left');
      // this.MouseTrap.unbind('right');
      // this.MouseTrap.unbind('enter');

      // for (let i = 1; i <= this.choiceList.length; i++) {
      //   this.MouseTrap.unbind(i.toString());
      // }

      SkldrMouseTrap.reset();
    },
    // bindNumberKey(n: number): void {
    //   this.MouseTrap.bind(n.toString(), () => {
    //     this.currentSelection = n - 1;
    //   });
    // },
  },
});
</script>
