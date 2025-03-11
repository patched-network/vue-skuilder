<template>
  <div>
    <svg :width="width" :height="height">
      <g
        v-for="(week, weekIndex) in weeks"
        :key="weekIndex"
        :transform="`translate(${weekIndex * (cellSize + cellMargin)}, 0)`"
      >
        <rect
          v-for="(day, dayIndex) in week"
          :key="day.date"
          :x="0"
          :y="dayIndex * (cellSize + cellMargin)"
          :width="cellSize"
          :height="cellSize"
          :fill="getColor(day.count)"
          @mouseover="showTooltip(day, $event)"
          @mouseout="hideTooltip"
        />
      </g>
    </svg>
    <div v-if="tooltipData" class="tooltip" :style="tooltipStyle">
      {{ tooltipData.count }} review{{ tooltipData.count !== 1 ? 's' : '' }} on {{ toDateString(tooltipData.date) }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { CardHistory, CardRecord } from '@vue-skuilder/db';
import moment from 'moment';
import { getCurrentUser } from '@/stores/useAuthStore';

export interface DayData {
  date: string;
  count: number;
}

export interface Color {
  h: number;
  s: number;
  l: number;
}

export default defineComponent({
  name: 'HeatMap',

  data() {
    return {
      heatmapData: {} as { [key: string]: number },
      weeks: [] as DayData[][],
      cellSize: 12,
      cellMargin: 3,
      tooltipData: null as DayData | null,
      tooltipStyle: {} as { [key: string]: string },
      maxInRange: 0,
      inactiveColor: { h: 0, s: 0, l: 0.9 } as Color,
      activeColor: { h: 155, s: 1, l: 0.5 } as Color,
    };
  },

  computed: {
    width(): number {
      return 53 * (this.cellSize + this.cellMargin);
    },
    height(): number {
      return 7 * (this.cellSize + this.cellMargin);
    },
  },

  async created() {
    console.log('Heatmap created');
    const history = await (await getCurrentUser()).getHistory();

    const allHist: CardHistory<CardRecord>[] = [];
    for (let i = 0; i < history.length; i++) {
      if (history[i]) {
        allHist.push(history[i]!);
      }
    }

    this.processHistory(allHist);
    this.createWeeksData();
  },

  methods: {
    toDateString(d: string): string {
      const m = moment(d);
      return moment.months()[m.month()] + ' ' + m.date();
    },

    processHistory(history: CardHistory<CardRecord>[]) {
      console.log(`Processing ${history.length} records`);
      const data: { [key: string]: number } = {};
      history.forEach((item) => {
        if (item && item.records) {
          item.records.forEach((record: CardRecord) => {
            const date = moment(record.timeStamp).format('YYYY-MM-DD');
            data[date] = (data[date] || 0) + 1;
          });
        }
      });
      this.heatmapData = data;
    },

    createWeeksData() {
      const end = moment();
      const start = end.clone().subtract(52, 'weeks');
      const day = start.clone().startOf('week');

      while (day.isSameOrBefore(end)) {
        const weekData: DayData[] = [];
        for (let i = 0; i < 7; i++) {
          const date = day.format('YYYY-MM-DD');
          const dayData: DayData = {
            date,
            count: this.heatmapData[date] || 0,
          };
          weekData.push(dayData);
          if (dayData.count > this.maxInRange) {
            this.maxInRange = dayData.count;
          }

          day.add(1, 'day');
        }
        this.weeks.push(weekData);
      }
    },

    getColor(count: number): string {
      if (this.maxInRange === 0) return this.hslToString(this.inactiveColor);

      const t = count === 0 ? 0 : Math.min((2 * count) / this.maxInRange, 1);

      let seasonalColor: Color = this.activeColor;

      const now = moment();
      if (now.month() === 11 && now.date() >= 5) {
        seasonalColor = Math.random() > 0.5 ? { h: 350, s: 0.8, l: 0.5 } : { h: 135, s: 0.8, l: 0.4 };
      } else if (now.month() === 9 && now.date() >= 25) {
        seasonalColor =
          Math.random() > 0.5
            ? { h: 0, s: 0, l: 0 }
            : Math.random() > 0.5
            ? { h: 30, s: 1, l: 0.5 }
            : { h: 270, s: 1, l: 0.5 };
      }

      const h = seasonalColor.h;
      const s = this.interpolate(this.inactiveColor.s, seasonalColor.s, t);
      const l = this.interpolate(this.inactiveColor.l, seasonalColor.l, t);

      return this.hslToString({ h, s, l });
    },

    interpolate(start: number, end: number, t: number): number {
      return start + (end - start) * t;
    },

    hslToString(color: Color): string {
      return `hsl(${color.h}, ${color.s * 100}%, ${color.l * 100}%)`;
    },

    showTooltip(day: DayData, event: MouseEvent) {
      this.tooltipData = day;
      this.tooltipStyle = {
        position: 'absolute',
        left: `${event.pageX + 10}px`,
        top: `${event.pageY + 10}px`,
      };
    },

    hideTooltip() {
      this.tooltipData = null;
    },
  },
});
</script>

<style scoped>
.tooltip {
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px;
  border-radius: 3px;
  font-size: 12px;
}

/* div {
  display: flex;
  justify-content: center;
} */
</style>
