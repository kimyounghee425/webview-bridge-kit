import { useEffect, useMemo, useRef } from "react";
import { createNativeBridge } from "./core/native";
import type { Handlers, NativeBridge } from "./core/native";
import type { BridgeOptions } from "./define";
import { rnTransport } from "./transport/rn-transport";
import type { BridgeSchema } from "./types";

// react-native-webview의 WebView ref와 호환되는 minimal 인터페이스 (rn-transport와 동일).
type WebViewLike = { injectJavaScript: (script: string) => void };
type WebViewRefLike = { current: WebViewLike | null };

// 컴포넌트 내부에서 native bridge를 안전하게 만들기 위한 hook.
// transport/bridge를 useMemo로 고정 + handler는 매 렌더 최신 값을 사용 (ref stash) +
// unmount 시 자동 dispose.
//
// 사용:
//   const ref = useRef<WebView>(null)
//   const { pushMessage } = useNativeBridge(ref, contract, {
//     GET_FCM_TOKEN: async () => ({ token: await messaging().getToken() }),
//     OPEN_CAMERA:   () => router.push('/screen/CameraScreen'),
//   })
//   return <WebView ref={ref} onMessage={(e) => pushMessage(e.nativeEvent.data)} ... />
//
// `options`는 stable reference여야 함 (모듈 상수 또는 useMemo로 고정 권장).
// 변경되어도 hook은 첫 렌더의 값을 사용.
export function useNativeBridge<S extends BridgeSchema>(
    ref: WebViewRefLike,
    contract: S,
    handlers: Handlers<S>,
    options?: BridgeOptions,
): {
    bridge: NativeBridge<S>;
    pushMessage: (data: string) => void;
} {
    // 매 렌더 새 handler 객체가 들어와도 bridge는 재생성되지 않도록 ref로 stash.
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    const transport = useMemo(() => rnTransport(ref), [ref]);

    const bridge = useMemo(() => {
        // proxy: bridge 호출 시점에 ref.current에서 최신 handler를 꺼냄.
        const proxy: Record<string, (payload: unknown) => unknown> = {};
        for (const key of Object.keys(contract)) {
            const def = contract[key as keyof S];
            if (def && (def.kind === "request" || def.kind === "command")) {
                proxy[key] = (payload) => {
                    const current = handlersRef.current as Record<string, (p: unknown) => unknown>;
                    return current[key]!(payload);
                };
            }
        }
        return createNativeBridge(transport, contract, options).bind(proxy as Handlers<S>);
        // options는 일부러 deps에서 제외 — 첫 렌더 값으로 고정 (위 docstring 참고).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transport, contract]);
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
                if (
                    latestBridgeRef.current === bridge &&
                    effectVersionRef.current === effectVersion
                ) {
                    bridge.dispose();
                }
            });
        };
    }, [bridge]);

    return { bridge, pushMessage: transport.pushMessage };
}
