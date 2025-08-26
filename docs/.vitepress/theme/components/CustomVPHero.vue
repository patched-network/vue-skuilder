<script setup lang="ts">
import type { DefaultTheme } from 'vitepress/theme';
import { useData } from 'vitepress';

export interface HeroAction {
  theme?: 'brand' | 'alt';
  text: string;
  link: string;
  target?: string;
  rel?: string;
}

defineProps<{
  name?: string;
  text?: string;
  tagline?: string;
  image?: DefaultTheme.ThemeableImage;
  actions?: HeroAction[];
}>();

const { site } = useData();

// For now, we'll always show the study session, but this could be conditional
const showStudySession = true;
</script>

<template>
  <div class="VPHero" :class="{ 'has-study-session': showStudySession }">
    <div class="container">
      <div class="main">
        <slot name="home-hero-info-before" />
        <slot name="home-hero-info">
          <h1 class="heading">
            <span v-if="name" v-html="name" class="name clip"></span>
            <span v-if="text" v-html="text" class="text"></span>
          </h1>
          <p v-if="tagline" v-html="tagline" class="tagline"></p>
        </slot>
        <slot name="home-hero-info-after" />

        <div v-if="actions" class="actions">
          <div v-for="action in actions" :key="action.link" class="action">
            <a
              class="vp-button"
              :class="`vp-button-${action.theme || 'brand'}`"
              :href="action.link"
              :target="action.target"
              :rel="action.rel"
            >
              {{ action.text }}
            </a>
          </div>
        </div>
        <slot name="home-hero-actions-after" />
      </div>

      <!-- Study Session Section - replaces the image section -->
      <div v-if="showStudySession" class="study-session">
        <div class="study-session-container">
          <!-- Placeholder for StudySessionWrapper -->
          <div class="study-placeholder">
            <h3>Interactive Study Session</h3>
            <p>Live demo will appear here</p>
            <div class="demo-card">
              <div class="card-content">Sample flashcard content</div>
              <div class="card-buttons">
                <button class="demo-btn">Again</button>
                <button class="demo-btn">Hard</button>
                <button class="demo-btn">Good</button>
                <button class="demo-btn">Easy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Base VPHero styles (copied from original) */
.VPHero {
  margin-top: calc((var(--vp-nav-height) + var(--vp-layout-top-height, 0px)) * -1);
  padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 48px) 24px 48px;
}

@media (min-width: 640px) {
  .VPHero {
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 80px) 48px 64px;
  }
}

@media (min-width: 960px) {
  .VPHero {
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 80px) 64px 64px;
  }
}

.container {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  max-width: 1152px;
}

@media (min-width: 960px) {
  .container {
    flex-direction: row;
    align-items: center;
    gap: 2rem;
  }
}

.main {
  position: relative;
  z-index: 10;
  order: 1; /* Text comes first on mobile */
  flex-grow: 1;
  flex-shrink: 0;
}

.VPHero.has-study-session .container {
  text-align: center;
}

@media (min-width: 960px) {
  .VPHero.has-study-session .container {
    text-align: left;
  }
}

@media (min-width: 960px) {
  .main {
    order: 1;
    width: calc(55%); /* Adjusted to give more space to study session */
  }

  .VPHero.has-study-session .main {
    max-width: none;
  }
}

/* Text styles (preserved from original - see adjacent file ./VPHero-ref.vue) */
.heading {
  display: flex;
  flex-direction: column;
}

.name,
.text {
  width: fit-content;
  max-width: 392px;
  letter-spacing: -0.4px;
  line-height: 40px;
  font-size: 32px;
  font-weight: 700;
  white-space: pre-wrap;
}

.VPHero.has-study-session .name,
.VPHero.has-study-session .text {
  margin: 0 auto;
}

.name {
  color: var(--vp-home-hero-name-color);
}

.clip {
  background: var(--vp-home-hero-name-background);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: var(--vp-home-hero-name-color);
}

@media (min-width: 640px) {
  .name,
  .text {
    max-width: 576px;
    line-height: 56px;
    font-size: 48px;
  }
}

@media (min-width: 960px) {
  .name,
  .text {
    line-height: 64px;
    font-size: 56px;
  }

  .VPHero.has-study-session .name,
  .VPHero.has-study-session .text {
    margin: 0;
  }
}

.tagline {
  padding-top: 8px;
  max-width: 392px;
  line-height: 28px;
  font-size: 18px;
  font-weight: 500;
  white-space: pre-wrap;
  color: var(--vp-c-text-2);
}

.VPHero.has-study-session .tagline {
  margin: 0 auto;
}

@media (min-width: 640px) {
  .tagline {
    padding-top: 12px;
    max-width: 576px;
    line-height: 32px;
    font-size: 20px;
  }
}

@media (min-width: 960px) {
  .tagline {
    line-height: 36px;
    font-size: 24px;
  }

  .VPHero.has-study-session .tagline {
    margin: 0;
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  margin: -6px;
  padding-top: 24px;
}

.VPHero.has-study-session .actions {
  justify-content: center;
}

@media (min-width: 640px) {
  .actions {
    padding-top: 32px;
  }
}

@media (min-width: 960px) {
  .VPHero.has-study-session .actions {
    justify-content: flex-start;
  }
}

.action {
  flex-shrink: 0;
  padding: 6px;
}

/* Study Session Styles - replaces image styles */
.study-session {
  order: 2; /* Place below text on mobile */
  margin: 2rem -24px 0; /* Add top margin, remove negative margins that cause overlay */
}

@media (min-width: 640px) {
  .study-session {
    margin: 2rem -24px 0; /* Keep positive margin on tablet */
  }
}

@media (min-width: 960px) {
  .study-session {
    flex-grow: 1;
    order: 2; /* Keep on right side on desktop */
    margin: 0;
    min-height: 400px;
    width: calc(45%);
  }
}

.study-session-container {
  position: relative;
  margin: 0 auto;
  width: 100%;
  max-width: 400px;
  min-height: 280px; /* Reduced height for mobile */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem; /* Add padding to prevent edge clipping */
}

@media (min-width: 640px) {
  .study-session-container {
    max-width: 450px;
    min-height: 320px;
  }
}

@media (min-width: 960px) {
  .study-session-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
    padding: 0; /* Remove padding on desktop */
  }
}

/* Placeholder Demo Styles */
.study-placeholder {
  background: var(--vp-c-bg-soft);
  border: 2px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.study-placeholder h3 {
  margin: 0 0 1rem 0;
  color: var(--vp-c-text-1);
  font-size: 1.25rem;
}

.study-placeholder p {
  margin: 0 0 1.5rem 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}

.demo-card {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.card-content {
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
  color: var(--vp-c-text-1);
}

.card-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.demo-btn {
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.demo-btn:hover {
  background: var(--vp-c-brand-2);
}

.demo-btn:nth-child(1) {
  background: var(--vp-c-red-1);
}
.demo-btn:nth-child(2) {
  background: var(--vp-c-yellow-1);
}
.demo-btn:nth-child(3) {
  background: var(--vp-c-green-1);
}
.demo-btn:nth-child(4) {
  background: var(--vp-c-blue-1);
}

.demo-btn:nth-child(1):hover {
  background: var(--vp-c-red-2);
}
.demo-btn:nth-child(2):hover {
  background: var(--vp-c-yellow-2);
}
.demo-btn:nth-child(3):hover {
  background: var(--vp-c-green-2);
}
.demo-btn:nth-child(4):hover {
  background: var(--vp-c-blue-2);
}

/* VitePress Button Styles */
.vp-button {
  display: inline-block;
  border-radius: 20px;
  padding: 0 20px;
  line-height: 38px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-button-brand-text);
  background-color: var(--vp-button-brand-bg);
  border: 2px solid var(--vp-button-brand-border);
  text-align: center;
  text-decoration: none !important;
  transition:
    color 0.25s,
    border-color 0.25s,
    background-color 0.25s;
}

.vp-button:hover {
  border-color: var(--vp-button-brand-hover-border);
  color: var(--vp-button-brand-hover-text);
  background-color: var(--vp-button-brand-hover-bg);
}

.vp-button-alt {
  color: var(--vp-button-alt-text);
  background-color: var(--vp-button-alt-bg);
  border-color: var(--vp-button-alt-border);
}

.vp-button-alt:hover {
  border-color: var(--vp-button-alt-hover-border);
  color: var(--vp-button-alt-hover-text);
  background-color: var(--vp-button-alt-hover-bg);
}
</style>
