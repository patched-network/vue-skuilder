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
  initialize: () => Promise<void>;
}

// Cache the dataLayer promise to prevent re-initialization across components
let dataLayerPromise: Promise<DataLayerProvider> | null = null;

/**
 * Composable for initializing a static data layer in VitePress.
 * It fetches the root skuilder.json manifest and passes it to the DataLayerProvider.
 */
export function useStaticDataLayer(): UseStaticDataLayerReturn {
  const dataLayer = ref<DataLayerProvider | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  const initialize = async (): Promise<void> => {
    if (dataLayer.value) {
      console.log('[useStaticDataLayer] Data layer already available, skipping initialization.');
      return;
    }

    // If another component is already initializing, just wait for its promise
    if (dataLayerPromise) {
      console.log('[useStaticDataLayer] Initialization already in progress, awaiting result...');
      isLoading.value = true;
      try {
        dataLayer.value = await dataLayerPromise;
      } catch (e) {
        error.value = e as Error;
      } finally {
        isLoading.value = false;
      }
      return;
    }

    try {
      isLoading.value = true;
      error.value = null;
      
      console.log('[useStaticDataLayer] Starting data layer initialization...');

      // 1. Fetch the root application manifest
      const rootManifestUrl = withBase('/skuilder.json');
      const rootManifestResponse = await fetch(rootManifestUrl);
      if (!rootManifestResponse.ok) {
        throw new Error(`Failed to fetch root manifest: ${rootManifestUrl}`);
      }
      const rootManifest = await rootManifestResponse.json();

      // 2. Prepare the simplified config for the DataLayerProvider
      const config: DataLayerConfig = {
        type: 'static',
        options: {
          rootManifest,
          rootManifestUrl: new URL(rootManifestUrl, window.location.href).href
        }
      };

      console.log('[useStaticDataLayer] Initializing data layer with root manifest.');
      
      // 3. Initialize the data layer and cache the promise
      dataLayerPromise = initializeDataLayer(config);
      dataLayer.value = await dataLayerPromise;
      
      console.log('[useStaticDataLayer] Data layer initialized successfully');
      
    } catch (e) {
      const err = e as Error;
      error.value = err;
      dataLayerPromise = null; // Clear promise on failure
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