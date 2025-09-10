
// docs/.vitepress/theme/composables/useStaticDataLayer.ts

import { ref, type Ref } from 'vue';
import { 
  type DataLayerProvider, 
  type DataLayerConfig,
  initializeDataLayer 
} from '@vue-skuilder/db';
import { withBase } from 'vitepress';

interface UseStaticDataLayerReturn {
  dataLayer: Ref<DataLayerProvider | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  initialize: (courseId: string) => Promise<void>;
}

// Cache for resolved course data to avoid re-fetching on every component mount
let resolvedCourses: Map<string, { manifest: any; baseUrl: string }> | null = null;

/**
 * Composable for initializing a static data layer in VitePress.
 * It now resolves all available courses from a root skuilder.json manifest.
 */
export function useStaticDataLayer(): UseStaticDataLayerReturn {
  const dataLayer = ref<DataLayerProvider | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  /**
   * Resolves all course dependencies from the root skuilder.json manifest.
   * This is the new runtime resolver logic.
   */
  const resolveCourseDependencies = async (): Promise<Map<string, { manifest: any; baseUrl: string }>> => {
    if (resolvedCourses) {
      return resolvedCourses;
    }

    console.log('[useStaticDataLayer] Starting course dependency resolution...');
    const newResolvedCourses = new Map<string, { manifest: any; baseUrl: string }>();

    // 1. Fetch the root application manifest
    const rootManifestUrl = withBase('/skuilder.json');
    const rootManifestResponse = await fetch(rootManifestUrl);
    if (!rootManifestResponse.ok) {
      throw new Error(`Failed to fetch root manifest: ${rootManifestUrl}`);
    }
    const rootManifest = await rootManifestResponse.json();
    console.log('[useStaticDataLayer] Loaded root manifest:', rootManifest);

    // 2. For each dependency, fetch its leaf manifest
    for (const [courseName, courseUrl] of Object.entries(rootManifest.dependencies || {})) {
      try {
        console.log(`[useStaticDataLayer] Resolving dependency: ${courseName} from ${courseUrl}`);
        
        // Construct absolute URL for the course's skuilder.json
        const courseManifestUrl = new URL(courseUrl as string, window.location.href).href;
        const courseJsonResponse = await fetch(courseManifestUrl);
        if (!courseJsonResponse.ok) {
          throw new Error(`Failed to fetch course manifest for ${courseName}`);
        }
        const courseJson = await courseJsonResponse.json();

        if (courseJson.content && courseJson.content.manifest) {
          const baseUrl = new URL('.', courseManifestUrl).href;
          const finalManifestUrl = new URL(courseJson.content.manifest, courseManifestUrl).href;

          const finalManifestResponse = await fetch(finalManifestUrl);
          if (!finalManifestResponse.ok) {
            throw new Error(`Failed to fetch final content manifest for ${courseName} at ${finalManifestUrl}`);
          }
          const finalManifest = await finalManifestResponse.json();
          
          newResolvedCourses.set(courseName, { manifest: finalManifest, baseUrl });
          console.log(`[useStaticDataLayer] Successfully resolved course: ${courseName}`);
        }
      } catch (e) {
        console.error(`[useStaticDataLayer] Failed to resolve dependency ${courseName}:`, e);
        // Continue to next dependency
      }
    }
    
    resolvedCourses = newResolvedCourses;
    console.log('[useStaticDataLayer] Course dependency resolution complete.');
    return resolvedCourses;
  };

  const initialize = async (courseId: string): Promise<void> => {
    if (dataLayer.value) {
      console.log('[useStaticDataLayer] Already initialized, skipping');
      return;
    }

    try {
      isLoading.value = true;
      error.value = null;
      
      console.log(`[useStaticDataLayer] Initializing for course ID: ${courseId}`);

      // 1. Resolve all courses
      const allCourses = await resolveCourseDependencies();
      
      // 2. Prepare config for DataLayerProvider
      const manifests: Record<string, any> = {};
      const courseLocations: Record<string, string> = {};
      const courseIds: string[] = [];

      for (const [name, data] of allCourses.entries()) {
        manifests[name] = data.manifest;
        courseLocations[name] = data.baseUrl;
        courseIds.push(name);
      }

      // This config structure anticipates a change in StaticDataLayerProvider
      // to accept `courseLocations` instead of a single `staticContentPath`.
      const config: DataLayerConfig = {
        type: 'static',
        options: {
          manifests,
          courseLocations, // New property
          COURSE_IDS: courseIds
        }
      };

      console.log('[useStaticDataLayer] Initializing data layer with config:', config);
      
      // 3. Initialize the data layer
      dataLayer.value = await initializeDataLayer(config);
      
      console.log('[useStaticDataLayer] Data layer initialized successfully');
      
    } catch (e) {
      const err = e as Error;
      error.value = err;
      console.error('[useStaticDataLayer] Failed to initialize data layer:', err);
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
