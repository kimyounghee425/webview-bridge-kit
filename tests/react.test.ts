import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineContract, event } from '../src/define';
import { PROTOCOL_VERSION } from '../src/envelope';
import type { Schema } from '../src/types';

const passthrough = <T>(): Schema<T> => ({ parse: (v) => v as T });

const contract = defineContract({
  PHOTO_TAKEN: event({ payload: passthrough<{ uri: string }>() }),
});

type MessageListener = (event: { data: unknown }) => void;

const reactMockState = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
}));

vi.mock('react', () => {
  type Context<T> = {
    current: T;
    Provider: { context: Context<T> };
  };

  return {
    createContext: <T,>(defaultValue: T): Context<T> => {
      const context = { current: defaultValue } as Context<T>;
      context.Provider = { context };
      return context;
    },
    createElement: <T,>(type: { context?: Context<T> }, props: { value?: T }, children: unknown) => {
      if (type.context) {
        type.context.current = props.value as T;
      }
      return { type, props: { ...props, children } };
    },
    useContext: <T,>(context: Context<T>): T => context.current,
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (typeof cleanup === 'function') {
        reactMockState.cleanups.push(cleanup);
      }
    },
    useMemo: <T,>(factory: () => T): T => factory(),
    useRef: <T,>(initialValue: T): { current: T } => ({ current: initialValue }),
  };
});

function stubWebViewWindow(): Set<MessageListener> {
  const listeners = new Set<MessageListener>();

  vi.stubGlobal('window', {
    addEventListener: vi.fn((type: string, listener: MessageListener) => {
      if (type === 'message') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: MessageListener) => {
      if (type === 'message') listeners.delete(listener);
    }),
    ReactNativeWebView: { postMessage: vi.fn() },
  });

  return listeners;
}

function dispatchBridgeEvent(listeners: Set<MessageListener>, payload: { uri: string }): void {
  const data = JSON.stringify({
    v: PROTOCOL_VERSION,
    kind: 'event',
    name: 'PHOTO_TAKEN',
    payload,
  });

  for (const listener of listeners) {
    listener({ data });
  }
}

describe('createBridgeClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    reactMockState.cleanups.length = 0;
  });

  it('provides a web bridge from BridgeProvider to useBridge', async () => {
    stubWebViewWindow();
    const { createBridgeClient } = await import('../src/react');
    const client = createBridgeClient(contract);

    client.BridgeProvider({ children: null });
    const bridge = client.useBridge();

    expect(bridge).toEqual({
      request: expect.any(Function),
      send: expect.any(Function),
      on: expect.any(Function),
      dispose: expect.any(Function),
    });
  });

  it('throws a clear error when useBridge is called outside BridgeProvider', async () => {
    const { createBridgeClient } = await import('../src/react');
    const client = createBridgeClient(contract);

    expect(() => client.useBridge()).toThrow('useBridge must be used within BridgeProvider.');
  });

  it('subscribes to bridge events with useBridgeEvent', async () => {
    const listeners = stubWebViewWindow();
    const { createBridgeClient } = await import('../src/react');
    const client = createBridgeClient(contract);
    const handler = vi.fn();

    client.BridgeProvider({ children: null });
    client.useBridgeEvent('PHOTO_TAKEN', handler);
    dispatchBridgeEvent(listeners, { uri: 'file://photo.jpg' });

    expect(handler).toHaveBeenCalledWith({ uri: 'file://photo.jpg' });
  });

  it('unsubscribes bridge events on cleanup', async () => {
    const listeners = stubWebViewWindow();
    const { createBridgeClient } = await import('../src/react');
    const client = createBridgeClient(contract);
    const handler = vi.fn();

    client.BridgeProvider({ children: null });
    client.useBridgeEvent('PHOTO_TAKEN', handler);
    reactMockState.cleanups[reactMockState.cleanups.length - 1]?.();
    dispatchBridgeEvent(listeners, { uri: 'file://photo.jpg' });

    expect(handler).not.toHaveBeenCalled();
  });
});
