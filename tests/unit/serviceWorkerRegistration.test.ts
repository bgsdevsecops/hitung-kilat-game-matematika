// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerServiceWorker,
  unregisterServiceWorker,
  applyServiceWorkerUpdate,
  _resetRefreshingStateForTesting,
} from '../../src/utils/serviceWorkerRegistration';

describe('serviceWorkerRegistration', () => {
  let originalNavigatorSW: unknown;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRefreshingStateForTesting();
    originalNavigatorSW = (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    originalLocation = window.location;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetRefreshingStateForTesting();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalNavigatorSW,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('does nothing if serviceWorker is not supported in navigator', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });

    const onUpdate = vi.fn();
    registerServiceWorker({ onUpdate });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('registers /sw.js on window load when supported and document not ready', async () => {
    const mockRegister = vi.fn().mockResolvedValue({
      onupdatefound: null,
      installing: null,
      waiting: null,
      active: null,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        addEventListener: vi.fn(),
      },
      configurable: true,
    });

    // Mock readyState as loading
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      configurable: true,
    });

    registerServiceWorker();
    expect(mockRegister).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
  });

  it('registers /sw.js immediately when document is already complete', async () => {
    const mockRegister = vi.fn().mockResolvedValue({
      onupdatefound: null,
      installing: null,
      waiting: null,
      active: null,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        addEventListener: vi.fn(),
      },
      configurable: true,
    });

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    });

    registerServiceWorker();
    expect(mockRegister).toHaveBeenCalledWith('/sw.js');
  });

  it('calls onUpdate if registration already has a waiting worker and controller is active', async () => {
    const mockRegistration = {
      waiting: { postMessage: vi.fn() },
      onupdatefound: null,
      installing: null,
      active: {},
    };

    const mockRegister = vi.fn().mockResolvedValue(mockRegistration);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: {},
        addEventListener: vi.fn(),
      },
      configurable: true,
    });

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    });

    const onUpdate = vi.fn();
    registerServiceWorker({ onUpdate });

    // Flush promises
    await Promise.resolve();
    expect(onUpdate).toHaveBeenCalledWith(mockRegistration);
  });

  it('triggers onUpdate on installing worker installed state when controller exists', async () => {
    let capturedRegistration: any = null;
    const mockRegister = vi.fn().mockImplementation(() => {
      capturedRegistration = {
        waiting: null,
        installing: null,
        onupdatefound: null,
      };
      return Promise.resolve(capturedRegistration);
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: {},
        addEventListener: vi.fn(),
      },
      configurable: true,
    });

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    });

    const onUpdate = vi.fn();
    const onSuccess = vi.fn();
    registerServiceWorker({ onUpdate, onSuccess });

    await Promise.resolve();

    // Simulate updatefound with installing worker
    const mockInstallingWorker: { state: string; onstatechange: (() => void) | null } = {
      state: 'installing',
      onstatechange: null,
    };
    capturedRegistration.installing = mockInstallingWorker;
    capturedRegistration.onupdatefound();

    // Now state changes to installed with controller present
    mockInstallingWorker.state = 'installed';
    mockInstallingWorker.onstatechange!();

    expect(onUpdate).toHaveBeenCalledWith(capturedRegistration);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('triggers onSuccess on installing worker installed state when no controller exists', async () => {
    let capturedRegistration: any = null;
    const mockRegister = vi.fn().mockImplementation(() => {
      capturedRegistration = {
        waiting: null,
        installing: null,
        onupdatefound: null,
      };
      return Promise.resolve(capturedRegistration);
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: null,
        addEventListener: vi.fn(),
      },
      configurable: true,
    });

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    });

    const onUpdate = vi.fn();
    const onSuccess = vi.fn();
    registerServiceWorker({ onUpdate, onSuccess });

    await Promise.resolve();

    const mockInstallingWorker: { state: string; onstatechange: (() => void) | null } = {
      state: 'installing',
      onstatechange: null,
    };
    capturedRegistration.installing = mockInstallingWorker;
    capturedRegistration.onupdatefound();

    mockInstallingWorker.state = 'installed';
    mockInstallingWorker.onstatechange!();

    expect(onSuccess).toHaveBeenCalledWith(capturedRegistration);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('calls onError if registration fails', async () => {
    const error = new Error('Registration failed');
    const mockRegister = vi.fn().mockRejectedValue(error);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        addEventListener: vi.fn(),
      },
      configurable: true,
    });

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    });

    const onError = vi.fn();
    registerServiceWorker({ onError });

    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('sends SKIP_WAITING and sets up single-shot reload in applyServiceWorkerUpdate', () => {
    const postMessageMock = vi.fn();
    let controllerChangeHandler: (() => void) | null = null;
    const addEventListenerMock = vi.fn().mockImplementation((event: string, handler: () => void) => {
      if (event === 'controllerchange') {
        controllerChangeHandler = handler;
      }
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: addEventListenerMock,
      },
      configurable: true,
    });

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    const mockRegistration = {
      waiting: {
        postMessage: postMessageMock,
      },
    } as unknown as ServiceWorkerRegistration;

    applyServiceWorkerUpdate(mockRegistration);

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(addEventListenerMock).toHaveBeenCalledWith('controllerchange', expect.any(Function));

    // Simulate controllerchange
    expect(controllerChangeHandler).toBeDefined();
    controllerChangeHandler!();
    expect(reloadMock).toHaveBeenCalledTimes(1);

    // Call it again to verify single-shot guard
    controllerChangeHandler!();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('unregisters active service worker registrations', async () => {
    const unregisterMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          unregister: unregisterMock,
        }),
      },
      configurable: true,
    });

    unregisterServiceWorker();
    await Promise.resolve();
    expect(unregisterMock).toHaveBeenCalled();
  });

  it('applyServiceWorkerUpdate gracefully handles missing waiting worker or unsupported serviceWorker', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });

    // Should not throw even if serviceWorker is undefined and waiting is undefined
    expect(() => {
      applyServiceWorkerUpdate({} as ServiceWorkerRegistration);
    }).not.toThrow();
  });

  it('unregisterServiceWorker gracefully handles unsupported serviceWorker or ready rejection', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });

    expect(() => {
      unregisterServiceWorker();
    }).not.toThrow();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        ready: Promise.reject(new Error('Ready failed')),
      },
      configurable: true,
    });

    unregisterServiceWorker();
    await Promise.resolve();
    await Promise.resolve();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Ready failed');
  });

  it('does nothing when installing worker is null on updatefound', async () => {
    let capturedRegistration: any = null;
    const mockRegister = vi.fn().mockImplementation(() => {
      capturedRegistration = {
        waiting: null,
        installing: null,
        onupdatefound: null,
      };
      return Promise.resolve(capturedRegistration);
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        controller: {},
        addEventListener: vi.fn(),
      },
      configurable: true,
    });

    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    });

    const onUpdate = vi.fn();
    registerServiceWorker({ onUpdate });
    await Promise.resolve();

    capturedRegistration.installing = null;
    expect(() => {
      capturedRegistration.onupdatefound();
    }).not.toThrow();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
