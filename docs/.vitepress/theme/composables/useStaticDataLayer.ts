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

/** Fetch the root skuilder.json and initialize the static data layer from it. */
async function createDataLayer(): Promise<DataLayerProvider> {
  const rootManifestUrl = withBase('/skuilder.json');
  const rootManifestResponse = await fetch(rootManifestUrl);
  if (!rootManifestResponse.ok) {
    throw new Error(`Failed to fetch root manifest: ${rootManifestUrl}`);
  }
  const rootManifest = await rootManifestResponse.json();

  const config: DataLayerConfig = {
    type: 'static',
    options: {
      rootManifest,
      rootManifestUrl: new URL(rootManifestUrl, window.location.href).href,
    },
  };
  return initializeDataLayer(config);
}

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
      return;
    }

    // Claim the shared promise synchronously, before any await, so that components initializing
    // at the same time share one initialization. (Otherwise a second caller can be handed the
    // data-layer singleton before its courses have been resolved.)
    if (!dataLayerPromise) {
      dataLayerPromise = createDataLayer();
      dataLayerPromise.catch(() => {
        dataLayerPromise = null; // allow a retry after failure
      });
    }

    isLoading.value = true;
    error.value = null;
    try {
      dataLayer.value = await dataLayerPromise;
    } catch (e) {
      error.value = e as Error;
      console.error('[useStaticDataLayer] Failed to initialize data layer:', e);
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