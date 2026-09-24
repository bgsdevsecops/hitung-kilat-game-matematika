export interface ServiceWorkerRegistrationConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

let isRefreshing = false;

export function registerServiceWorker(config?: ServiceWorkerRegistrationConfig): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker) {
    return;
  }

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // If a waiting worker already exists (e.g. from previous background fetch)
        if (registration.waiting && navigator.serviceWorker.controller) {
          config?.onUpdate?.(registration);
        }

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New update available
                config?.onUpdate?.(registration);
              } else {
                // Content cached for offline use
                config?.onSuccess?.(registration);
              }
            }
          };
        };
      })
      .catch((error) => {
        config?.onError?.(error);
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  if (registration && registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isRefreshing) {
        isRefreshing = true;
        window.location.reload();
      }
    });
  }
}

export function unregisterServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
