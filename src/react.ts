import { createContext, createElement, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { createWebBridge } from './core/web';
import type { WebBridge } from './core/web';
import type { BridgeOptions } from './define';
import { webTransport } from './transport/web-transport';
import type { BridgeSchema, EventKey, PayloadOf } from './types';

export type BridgeProviderProps = {
  children?: ReactNode;
};

export type BridgeClient<S extends BridgeSchema> = {
  BridgeProvider: (props: BridgeProviderProps) => ReactElement;
  useBridge: () => WebBridge<S>;
  useBridgeEvent: <K extends EventKey<S>>(
    name: K,
    handler: (payload: PayloadOf<S[K]>) => void,
  ) => void;
};

export function createBridgeClient<S extends BridgeSchema>(
  contract: S,
  options?: BridgeOptions,
): BridgeClient<S> {
  const BridgeContext = createContext<WebBridge<S> | null>(null);

  function BridgeProvider({ children }: BridgeProviderProps): ReactElement {
    const bridge = useWebBridge(contract, options);
    return createElement(BridgeContext.Provider, { value: bridge }, children);
  }
  BridgeProvider.displayName = 'BridgeProvider';

  function useBridge(): WebBridge<S> {
    const bridge = useContext(BridgeContext);
    if (!bridge) {
      throw new Error('useBridge must be used within BridgeProvider.');
    }
    return bridge;
  }

  function useBridgeEvent<K extends EventKey<S>>(
    name: K,
    handler: (payload: PayloadOf<S[K]>) => void,
  ): void {
    const bridge = useBridge();
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
      return bridge.on(name, (payload) => {
        handlerRef.current(payload);
      });
    }, [bridge, name]);
  }

  return { BridgeProvider, useBridge, useBridgeEvent };
}

// React 컴포넌트 내부에서 web bridge를 안전하게 만들기 위한 hook.
// bridge를 useMemo로 고정하고 unmount 시 자동 dispose한다.
//
// `options`는 첫 렌더 값으로 고정된다. 변경이 필요하면 hook 호출부에서 key를 바꿔
// 컴포넌트를 remount하거나 core API로 직접 생명주기를 제어한다.
export function useWebBridge<S extends BridgeSchema>(
  contract: S,
  options?: BridgeOptions,
): WebBridge<S> {
  const optionsRef = useRef(options);

  const bridge = useMemo(
    () => createWebBridge(webTransport(), contract, optionsRef.current),
    [contract],
  );
  const latestBridgeRef = useRef(bridge);
  const effectVersionRef = useRef(0);
  latestBridgeRef.current = bridge;

  useEffect(() => {
    const effectVersion = ++effectVersionRef.current;
    return () => {
      if (latestBridgeRef.current !== bridge) {
        bridge.dispose();
        return;
      }
      // React StrictMode can run cleanup during a dev-only remount probe.
      queueMicrotask(() => {
        if (latestBridgeRef.current === bridge && effectVersionRef.current === effectVersion) {
          bridge.dispose();
        }
      });
    };
  }, [bridge]);

  return bridge;
}
