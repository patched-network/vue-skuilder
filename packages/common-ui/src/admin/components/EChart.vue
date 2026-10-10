<template>
  <div ref="el" :style="{ height: `${height}px`, width: '100%' }" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { init, use, type ECElementEvent, type EChartsCoreOption, type EChartsType } from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

/**
 * An ECharts canvas for the admin views. Registers only what they draw, so
 * the admin bundle carries a fraction of ECharts. Options are replaced
 * whole on change (`notMerge`): callers compute the full option.
 */
use([
  LineChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const props = defineProps<{ option: EChartsCoreOption; height: number }>();
const emit = defineEmits<{ click: [event: ECElementEvent] }>();

const el = ref<HTMLElement | null>(null);
const chart = shallowRef<EChartsType | null>(null);
let resize: ResizeObserver | null = null;

onMounted(() => {
  if (!el.value) return;
  chart.value = init(el.value);
  chart.value.setOption(props.option, { notMerge: true });
  chart.value.on('click', (e) => emit('click', e as ECElementEvent));
  resize = new ResizeObserver(() => chart.value?.resize());
  resize.observe(el.value);
});

watch(
  () => props.option,
  (option) => chart.value?.setOption(option, { notMerge: true })
);

onBeforeUnmount(() => {
  resize?.disconnect();
  chart.value?.dispose();
});
</script>
