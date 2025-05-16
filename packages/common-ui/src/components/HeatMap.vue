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
import { defineComponent, PropType } from 'vue';
import moment from 'moment';
import { DayData, Color, ActivityRecord } from './HeatMap.types';

export default defineComponent({
  name: 'HeatMap',

  props: {
    // Accept activity records directly as a prop
    activityRecords: {
      type: Array as PropType<ActivityRecord[]>,
      default: () => [],
    },
    // Accept a function that can retrieve activity records
    activityRecordsGetter: {
      type: Function as PropType<() => Promise<ActivityRecord[]>>,
      default: null,
    },
    // Customize colors
    inactiveColor: {
      type: Object as PropType<Color>,
      default: () => ({ h: 0, s: 0, l: 0.9 }),
    },
    activeColor: {
      type: Object as PropType<Color>,
      default: () => ({ h: 155, s: 1, l: 0.5 }),
    },
    // Customize size
    cellSize: {
      type: Number,
      default: 12,
    },
    cellMargin: {
      type: Number,
      default: 3,
    },
    // Enable/disable seasonal colors
    enableSeasonalColors: {
      type: Boolean,
      default: true,
    },
  },

  data() {
    return {
      isLoading: false,
      localActivityRecords: [] as ActivityRecord[],
      heatmapData: {} as { [key: string]: number },
      weeks: [] as DayData[][],
      tooltipData: null as DayData | null,
      tooltipStyle: {} as { [key: string]: string },
      maxInRange: 0,
    };
  },

  computed: {
    width(): number {
      return 53 * (this.cellSize + this.cellMargin);
    },
    height(): number {
      return 7 * (this.cellSize + this.cellMargin);
    },
    effectiveActivityRecords(): ActivityRecord[] {
      const useLocal = Array.isArray(this.localActivityRecords) && this.localActivityRecords.length > 0;
      const records = useLocal ? this.localActivityRecords : this.activityRecords || [];
      console.log('Using effectiveActivityRecords, count:', records.length, 'source:', useLocal ? 'local' : 'prop');
      return records;
    },
  },

  watch: {
    activityRecords: {
      handler() {
        this.processRecords();
        this.createWeeksData();
      },
      immediate: true,
    },
  },

  async created() {
    if (this.activityRecordsGetter) {
      try {
        this.isLoading = true;
        console.log('Fetching activity records using getter...');
        
        // Ensure the getter is called safely with proper error handling
        let result = await this.activityRecordsGetter();
        
        // Handle the result - ensure it's an array of activity records
        if (Array.isArray(result)) {
          // Filter out records with invalid timestamps before processing
          this.localActivityRecords = result.filter(record => {
            if (!record || !record.timeStamp) return false;
            
            // Basic validation check for timestamps
            try {
              const m = moment(record.timeStamp);
              return m.isValid() && m.year() > 2000 && m.year() < 2100;
            } catch (e) {
              return false;
            }
          });
          
          console.log(`Received ${result.length} records, ${this.localActivityRecords.length} valid after filtering`);
          
          // Process the loaded records
          this.processRecords();
          this.createWeeksData();
        } else {
          console.error('Activity records getter did not return an array:', result);
          this.localActivityRecords = [];
        }
      } catch (error) {
        console.error('Error fetching activity records:', error);
        this.localActivityRecords = [];
      } finally {
        this.isLoading = false;
      }
    } else {
      console.log('No activityRecordsGetter provided, using direct activityRecords prop');
    }
  },

  methods: {
    toDateString(d: string): string {
      const m = moment(d);
      return moment.months()[m.month()] + ' ' + m.date();
    },

    processRecords() {
      const records = this.effectiveActivityRecords || [];
      console.log(`Processing ${records.length} records`);

      const data: { [key: string]: number } = {};

      if (records.length === 0) {
        console.log('No records to process');
        this.heatmapData = data;
        return;
      }

      // Sample logging of a few records to understand structure without flooding console
      const uniqueDates = new Set<string>();
      const dateDistribution: Record<string, number> = {};
      let validCount = 0;
      let invalidCount = 0;
      
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        if (!record || typeof record !== 'object' || !record.timeStamp) {
          invalidCount++;
          continue;
        }
        
        try {
          // Attempt to normalize the timestamp
          let normalizedDate: string;
          
          if (typeof record.timeStamp === 'string') {
            // For ISO strings, parse directly with moment
            normalizedDate = moment(record.timeStamp).format('YYYY-MM-DD');
          } else if (typeof record.timeStamp === 'number') {
            // For numeric timestamps, use Date constructor then moment
            normalizedDate = moment(new Date(record.timeStamp)).format('YYYY-MM-DD');
          } else if (typeof record.timeStamp === 'object') {
            // For objects (like Moment), try toString() or direct parsing
            if (typeof record.timeStamp.format === 'function') {
              // It's likely a Moment object
              normalizedDate = record.timeStamp.format('YYYY-MM-DD');
            } else if (record.timeStamp instanceof Date) {
              normalizedDate = moment(record.timeStamp).format('YYYY-MM-DD');
            } else {
              // Try to parse it as a string representation
              normalizedDate = moment(String(record.timeStamp)).format('YYYY-MM-DD');
            }
          } else {
            // Unhandled type
            invalidCount++;
            continue;
          }
          
          // Verify the date is valid before using it
          if (moment(normalizedDate, 'YYYY-MM-DD', true).isValid()) {
            data[normalizedDate] = (data[normalizedDate] || 0) + 1;
            uniqueDates.add(normalizedDate);
            
            // Track distribution by month for debugging
            const month = normalizedDate.substring(0, 7); // YYYY-MM
            dateDistribution[month] = (dateDistribution[month] || 0) + 1;
            
            validCount++;
          } else {
            invalidCount++;
          }
        } catch (e) {
          invalidCount++;
        }
      }
      
      // Log summary statistics
      console.log(`Processed ${validCount} valid dates, ${invalidCount} invalid dates`);
      console.log(`Found ${uniqueDates.size} unique dates`);
      console.log('Date distribution by month:', dateDistribution);

      this.heatmapData = data;
    },

    createWeeksData() {
      // Reset weeks and max count
      this.weeks = [];
      this.maxInRange = 0;
      
      const end = moment();
      const start = end.clone().subtract(52, 'weeks');
      const day = start.clone().startOf('week');
      
      console.log('Creating weeks data from', start.format('YYYY-MM-DD'), 'to', end.format('YYYY-MM-DD'));
      
      // Ensure we have data to display
      if (Object.keys(this.heatmapData).length === 0) {
        console.log('No heatmap data available to display');
      }

      // For debugging, log some sample dates from the heatmap data
      const sampleDates = Object.keys(this.heatmapData).slice(0, 5);
      console.log('Sample dates in heatmap data:', sampleDates);
      
      // Build the week data structure
      while (day.isSameOrBefore(end)) {
        const weekData: DayData[] = [];
        for (let i = 0; i < 7; i++) {
          const date = day.format('YYYY-MM-DD');
          const count = this.heatmapData[date] || 0;
          const dayData: DayData = {
            date,
            count,
          };
          weekData.push(dayData);
          if (dayData.count > this.maxInRange) {
            this.maxInRange = dayData.count;
          }

          day.add(1, 'day');
        }
        this.weeks.push(weekData);
      }
      
      console.log('Weeks data created, maxInRange:', this.maxInRange);
      
      // Calculate summary stats for display
      let totalDaysWithActivity = 0;
      let totalActivity = 0;
      
      Object.values(this.heatmapData).forEach(count => {
        totalDaysWithActivity++;
        totalActivity += count;
      });
      
      console.log(`Activity summary: ${totalActivity} activities across ${totalDaysWithActivity} days`);
    },

    getColor(count: number): string {
      if (this.maxInRange === 0) return this.hslToString(this.inactiveColor);

      const t = count === 0 ? 0 : Math.min((2 * count) / this.maxInRange, 1);

      let seasonalColor: Color = this.activeColor;

      if (this.enableSeasonalColors) {
        const now = moment();
        if (now.month() === 11 && now.date() >= 5) {
          // Christmas colors
          seasonalColor = Math.random() > 0.5 ? { h: 350, s: 0.8, l: 0.5 } : { h: 135, s: 0.8, l: 0.4 };
        } else if (now.month() === 9 && now.date() >= 25) {
          // Halloween colors
          seasonalColor =
            Math.random() > 0.5
              ? { h: 0, s: 0, l: 0 }
              : Math.random() > 0.5
              ? { h: 30, s: 1, l: 0.5 }
              : { h: 270, s: 1, l: 0.5 };
        }
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
</style>
