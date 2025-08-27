// docs/.vitepress/theme/composables/useStaticDataLayer.ts

import { ref, type Ref } from 'vue';
import { 
  type DataLayerProvider, 
  type DataLayerConfig,
  initializeDataLayer 
} from '@vue-skuilder/db';

interface UseStaticDataLayerReturn {
  dataLayer: Ref<DataLayerProvider | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  initialize: () => Promise<void>;
}

/**
 * Composable for initializing static data layer in VitePress docs context
 * Provides localStorage persistence and error handling
 */
export function useStaticDataLayer(courseIds: string[] = ['2aeb8315ef78f3e89ca386992d00825b']): UseStaticDataLayerReturn {
  const dataLayer = ref<DataLayerProvider | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  const initialize = async (): Promise<void> => {
    if (dataLayer.value) {
      console.log('[useStaticDataLayer] Already initialized, skipping');
      return;
    }

    try {
      isLoading.value = true;
      error.value = null;
      
      console.log('[useStaticDataLayer] Initializing with course IDs:', courseIds);

      // Load individual manifests for each course (following testproject pattern)
      const manifests: Record<string, any> = {};
      
      for (const courseId of courseIds) {
        try {
          console.log(`[useStaticDataLayer] Loading manifest for course: ${courseId}`);
          const manifestResponse = await fetch(`./static-courses/${courseId}/manifest.json`);
          
          if (!manifestResponse.ok) {
            throw new Error(`Failed to load manifest: ${manifestResponse.status} ${manifestResponse.statusText}`);
          }
          
          const manifest = await manifestResponse.json();
          manifests[courseId] = manifest;
          console.log(`[useStaticDataLayer] Loaded manifest for course ${courseId}:`, manifest.courseName || 'Unknown');
          
        } catch (manifestError) {
          console.error(`[useStaticDataLayer] Failed to load manifest for course ${courseId}:`, manifestError);
          throw new Error(`Could not load course manifest for ${courseId}: ${manifestError}`);
        }
      }

      console.log('[useStaticDataLayer] All manifests loaded:', Object.keys(manifests));

      // Configure static data layer (following testproject pattern)
      const config: DataLayerConfig = {
        type: 'static',
        options: {
          staticContentPath: './static-courses',
          manifests,
          COURSE_IDS: courseIds
        }
      };

      console.log('[useStaticDataLayer] Initializing data layer with config');
      
      // Initialize the data layer
      dataLayer.value = await initializeDataLayer(config);
      
      console.log('[useStaticDataLayer] Data layer initialized successfully');
      
    } catch (e) {
      const err = e as Error;
      error.value = err;
      console.error('[useStaticDataLayer] Failed to initialize data layer:', err);
      console.error('[useStaticDataLayer] Error details:', {
        message: err.message,
        stack: err.stack,
        courseIds,
      });
    } finally {
      isLoading.value = false;
    }
  };

  return {
    dataLayer,
    error,
    isLoading,
    initialize
  };
}