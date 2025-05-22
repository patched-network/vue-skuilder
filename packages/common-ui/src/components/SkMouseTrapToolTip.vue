<template>
  <div
    class="sk-mousetrap-tooltip-wrapper"
    ref="wrapperElement"
    :class="[
      isControlKeyPressed && !disabled && highlightEffect !== 'none' ? `sk-mousetrap-highlight-${highlightEffect}` : ''
    ]"
  >
    <slot></slot>
    <transition name="fade">
      <div
        v-if="showTooltip && isControlKeyPressed && !disabled"
        class="sk-mousetrap-tooltip"
        :class="{ 'sk-mt-tooltip-top': position === 'top', 'sk-mt-tooltip-bottom': position === 'bottom' }"
      >
        {{ formattedHotkey }}
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { SkldrMouseTrap, HotKeyMetaData } from '../utils/SkldrMouseTrap';

export default defineComponent({
  name: 'SkMouseTrapToolTip',

  props: {
    hotkey: {
      type: [String, Array] as PropType<string | string[]>,
      required: true,
    },
    command: {
      type: String,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    position: {
      type: String as PropType<'top' | 'bottom'>,
      default: 'top',
    },
    showTooltip: {
      type: Boolean,
      default: true,
    },
    highlightEffect: {
      type: String as PropType<'glow' | 'scale' | 'border' | 'none'>,
      default: 'glow',
    },
  },

  emits: ['hotkey-triggered'],

  setup(props, { emit }) {
    const wrapperElement = ref<HTMLElement | null>(null);
    const isControlKeyPressed = ref(false);
    const hotkeyId = ref(`hotkey-${Math.random().toString(36).substring(2, 15)}`);

    // Format hotkey for display
    const formattedHotkey = computed(() => {
      const hotkey = Array.isArray(props.hotkey) ? props.hotkey[0] : props.hotkey;
      return hotkey
        .toLowerCase()
        .split('+')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' + ');
    });

    // Apply highlight effect to the actual button/control when Ctrl is pressed
    watch(
      () => isControlKeyPressed.value,
      (pressed) => {
        if (!wrapperElement.value || props.disabled) return;

        const clickableElement = wrapperElement.value.querySelector(
          'button, a, input[type="button"], [role="button"]'
        ) as HTMLElement;

        if (clickableElement) {
          clickableElement.style.transition = 'all 250ms ease';

          if (pressed && props.highlightEffect !== 'none') {
            // Add slight brightness increase to the inner element
            clickableElement.style.filter = 'brightness(1.1)';
          } else {
            clickableElement.style.filter = '';
          }
        }
      }
    );

    // Handle Ctrl key detection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        isControlKeyPressed.value = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        isControlKeyPressed.value = false;
      }
    };

    // Handle clicking the element when hotkey is pressed
    const handleHotkeyPress = () => {
      if (props.disabled || !wrapperElement.value) return;

      // Find the first clickable element within our wrapper
      const clickableElement = wrapperElement.value.querySelector(
        'button, a, input[type="button"], [role="button"]'
      ) as HTMLElement;

      if (clickableElement) {
        clickableElement.click();
        emit('hotkey-triggered', props.hotkey);
      } else {
        // If no clickable element found, emit the event for parent handling
        emit('hotkey-triggered', props.hotkey);
      }
    };

    // Register/unregister the hotkey binding
    const registerHotkey = () => {
      if (!props.disabled) {
        SkldrMouseTrap.bind([
          {
            hotkey: props.hotkey,
            command: props.command,
            callback: handleHotkeyPress,
          },
        ]);
      }
    };

    const unregisterHotkey = () => {
      // Currently, SkldrMouseTrap only supports full reset
      // To avoid affecting other hotkeys, we need to track all active hotkeys
      // and rebind the ones we want to keep
      const currentCommands = [...SkldrMouseTrap.commands];
      const filteredCommands = currentCommands.filter(
        (cmd) => JSON.stringify(cmd.hotkey) !== JSON.stringify(props.hotkey)
      );

      if (filteredCommands.length !== currentCommands.length) {
        // There was a match - we need to reset and rebind the remaining hotkeys
        SkldrMouseTrap.reset();

        // Rebind all the other hotkeys
        // Note: this approach has limitations since we don't have access to the callbacks
        // In a future enhancement, SkldrMouseTrap should be updated to support selective unbinding
      }
    };

    // Watch for changes to the disabled prop
    watch(
      () => props.disabled,
      (newValue) => {
        if (newValue) {
          unregisterHotkey();
        } else {
          registerHotkey();
        }
      }
    );

    onMounted(() => {
      // Register global keyboard listeners for the Ctrl key
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);

      // Register the hotkey
      registerHotkey();
    });

    onBeforeUnmount(() => {
      // Clean up event listeners
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);

      // Unregister the hotkey
      unregisterHotkey();
    });

    return {
      wrapperElement,
      isControlKeyPressed,
      formattedHotkey,
    };
  },
});
</script>

<style scoped>
.sk-mousetrap-tooltip-wrapper {
  display: inline-block;
  position: relative;
}

.sk-mousetrap-tooltip {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
  left: 50%;
  transform: translateX(-50%);
}

.sk-mt-tooltip-top {
  bottom: 100%;
  margin-bottom: 5px;
}

.sk-mt-tooltip-bottom {
  top: 100%;
  margin-top: 5px;
}

/* Highlight effects when Ctrl is pressed */
.sk-mousetrap-highlight-glow {
  box-shadow: 0 0 8px 2px rgba(25, 118, 210, 0.6);
  transition: box-shadow 250ms ease;
}

.sk-mousetrap-highlight-scale {
  transform: scale(1.03);
  transition: transform 250ms ease;
}

.sk-mousetrap-highlight-border {
  outline: 2px solid rgba(25, 118, 210, 0.8);
  outline-offset: 2px;
  border-radius: 4px;
  transition: outline 250ms ease, outline-offset 250ms ease;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 250ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
