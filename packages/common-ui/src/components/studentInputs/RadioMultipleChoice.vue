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
import UserInput from './BaseUserInput';
import MultipleChoiceOption from './MultipleChoiceOption.vue';
import { defineComponent, PropType } from 'vue';
import { SkldrMouseTrap } from '../../utils/SkldrMouseTrap';
import { RadioMultipleChoiceAnswer } from './RadioMultipleChoice.types';

export default defineComponent({
  name: 'RadioMultipleChoice',
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
      _registeredHotkeys: [] as (string | string[])[],
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
        const ans: RadioMultipleChoiceAnswer = {
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
      const hotkeys = [
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
          command: `Select ${((i) => {
            switch (i) {
              case 0:
                return 'first';
              case 1:
                return 'second';
              case 2:
                return 'third';
              case 3:
                return 'fourth';
              case 4:
                return 'fifth';
              case 5:
                return 'sixth';
              default:
                return `${i + 1}th`;
            }
          })(i)} option`,
        })),
      ];

      SkldrMouseTrap.addBinding(hotkeys);
      
      // Store hotkeys for cleanup
      this._registeredHotkeys = hotkeys.map(k => k.hotkey);
    },

    unbindKeys() {
      // Remove specific hotkeys instead of resetting all
      if (this._registeredHotkeys) {
        this._registeredHotkeys.forEach(key => {
          SkldrMouseTrap.removeBinding(key);
        });
      }
    },
    // bindNumberKey(n: number): void {
    //   this.MouseTrap.bind(n.toString(), () => {
    //     this.currentSelection = n - 1;
    //   });
    // },
  },
});
</script>
