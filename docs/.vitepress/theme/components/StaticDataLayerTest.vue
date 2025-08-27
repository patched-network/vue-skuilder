<!-- Test component for useStaticDataLayer composable -->
<template>
  <div class="data-layer-test">
    <h3>Static Data Layer Test</h3>
    
    <div v-if="isLoading" class="loading">
      <p>⏳ Initializing data layer...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <p>❌ Error: {{ error.message }}</p>
      <details>
        <summary>Error Details</summary>
        <pre>{{ error.stack }}</pre>
      </details>
      <button @click="retry">Retry</button>
    </div>
    
    <div v-else-if="dataLayer" class="success">
      <p>✅ Data layer initialized successfully!</p>
      <div class="data-layer-info">
        <p><strong>User DB:</strong> {{ userInfo }}</p>
        <p><strong>Available Courses:</strong> {{ availableCourses }}</p>
      </div>
      <button @click="testCourseAccess">Test Course Access</button>
    </div>
    
    <div v-else class="idle">
      <p>Ready to initialize</p>
      <button @click="initialize">Initialize Data Layer</button>
      <button @click="probeUrls">Probe URLs First</button>
    </div>
    
    <div v-if="urlProbeResults.length > 0" class="probe-results">
      <h4>URL Probe Results:</h4>
      <div v-for="(result, index) in urlProbeResults" :key="index" class="probe-item">
        {{ result }}
      </div>
    </div>
    
    <div v-if="courseTestResult" class="course-test">
      <h4>Course Test Result:</h4>
      <pre>{{ courseTestResult }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { withBase, useData } from 'vitepress';
import { useStaticDataLayer } from '../composables/useStaticDataLayer';

// VitePress data
const { site } = useData();

// Initialize composable
const { dataLayer, error, isLoading, initialize } = useStaticDataLayer();

// Test state
const courseTestResult = ref<string>('');
const urlProbeResults = ref<string[]>([]);
const courseId = '2aeb8315ef78f3e89ca386992d00825b';

// Computed properties for display
const userInfo = computed(() => {
  if (!dataLayer.value) return 'Not available';
  try {
    const userDB = dataLayer.value.getUserDB();
    return `Username: ${userDB.getUsername()}`;
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
});

const availableCourses = computed(() => {
  if (!dataLayer.value) return 'Not available';
  try {
    const coursesDB = dataLayer.value.getCoursesDB();
    return 'Courses DB available';
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
});

// Test methods
const retry = () => {
  courseTestResult.value = '';
  initialize();
};

const testCourseAccess = async () => {
  if (!dataLayer.value) {
    courseTestResult.value = 'Data layer not available';
    return;
  }
  
  try {
    console.log('[Test] Testing course access...');
    
    // Test getting course DB
    const courseDB = dataLayer.value.getCourseDB('2aeb8315ef78f3e89ca386992d00825b');
    console.log('[Test] Course DB:', courseDB);
    
    // Test getting course config
    const coursesDB = dataLayer.value.getCoursesDB();
    const courseConfig = await coursesDB.getCourseConfig('2aeb8315ef78f3e89ca386992d00825b');
    console.log('[Test] Course config:', courseConfig);
    
    courseTestResult.value = JSON.stringify({
      courseDB: 'Available',
      courseName: courseConfig.name,
      courseDescription: courseConfig.description
    }, null, 2);
    
  } catch (e) {
    const err = e as Error;
    console.error('[Test] Course access error:', err);
    courseTestResult.value = `Error: ${err.message}`;
  }
};

// URL probing function
const probeUrls = async () => {
  urlProbeResults.value = [];
  
  // Test various URL patterns based on VitePress asset handling
  const urlsToTest = [
    // Standard public asset paths
    `/static-courses/${courseId}/manifest.json`,
    `./static-courses/${courseId}/manifest.json`,
    
    // With base URL (if configured)
    withBase(`/static-courses/${courseId}/manifest.json`),
    withBase(`static-courses/${courseId}/manifest.json`),
    
    // Site base variations
    `${site.value.base}static-courses/${courseId}/manifest.json`,
    `${site.value.base}/static-courses/${courseId}/manifest.json`,
    
    // Alternative patterns
    `/vue-skuilder/static-courses/${courseId}/manifest.json`,
    `./vue-skuilder/static-courses/${courseId}/manifest.json`,
    
    // Absolute from current location
    `${window.location.origin}/vue-skuilder/static-courses/${courseId}/manifest.json`,
    `${window.location.origin}/static-courses/${courseId}/manifest.json`,
  ];
  
  console.log('[ProbeUrls] Testing URLs:', urlsToTest);
  console.log('[ProbeUrls] Current location:', window.location.href);
  console.log('[ProbeUrls] Site base:', site.value.base);
  
  for (const url of urlsToTest) {
    try {
      const response = await fetch(url);
      const status = response.ok ? '✅' : '❌';
      const result = `${status} ${response.status} ${url}`;
      urlProbeResults.value.push(result);
      console.log('[ProbeUrls]', result);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[ProbeUrls] SUCCESS! Data preview:', {
          courseId: data.courseId,
          courseName: data.courseName,
          documentCount: data.documentCount
        });
      }
    } catch (error) {
      const result = `❌ ERROR ${url} - ${(error as Error).message}`;
      urlProbeResults.value.push(result);
      console.error('[ProbeUrls]', result, error);
    }
  }
};

// Auto-initialize on mount (commented out for manual testing)
onMounted(() => {
  // initialize();
  console.log('[StaticDataLayerTest] Mounted. Site config:', {
    base: site.value.base,
    url: site.value.url,
    location: window.location.href
  });
});
</script>

<style scoped>
.data-layer-test {
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
  background: var(--vp-c-bg-soft);
}

.loading {
  color: var(--vp-c-text-2);
}

.error {
  color: var(--vp-c-red);
}

.error details {
  margin-top: 0.5rem;
}

.error pre {
  background: var(--vp-c-bg);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  overflow-x: auto;
}

.success {
  color: var(--vp-c-green);
}

.data-layer-info {
  margin: 0.5rem 0;
  padding: 0.5rem;
  background: var(--vp-c-bg);
  border-radius: 4px;
  color: var(--vp-c-text-1);
}

.course-test {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--vp-c-border);
}

.course-test pre {
  background: var(--vp-c-bg);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  overflow-x: auto;
}

.probe-results {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--vp-c-border);
}

.probe-item {
  font-family: monospace;
  font-size: 0.85rem;
  padding: 0.25rem;
  margin: 0.1rem 0;
  background: var(--vp-c-bg);
  border-radius: 3px;
  color: var(--vp-c-text-1);
}

button {
  background: var(--vp-c-brand);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 0.5rem;
}

button:hover {
  background: var(--vp-c-brand-dark);
}
</style>