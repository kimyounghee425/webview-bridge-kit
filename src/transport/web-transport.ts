import type { Transport } from "./types";

// RN WebView 안에서 동작하는 web 측 transport.
// 환경 의존(window, window.ReactNativeWebView)은 send/onMessage 호출 시점에 lazy access.
// 모듈 import 시점엔 평가하지 않음 — SSR/Node 테스트에서 폭발 방지.
export function webTransport(): Transport {
    return {
        send: (data) => {
            const target = (
                window as unknown as {
                    ReactNativeWebView?: { postMessage: (s: string) => void };
                }
            ).ReactNativeWebView;
            if (!target) {
                // RN WebView 호스트가 없는 환경 (브라우저 직접 띄움 등). silent drop.
                return;
            }
            target.postMessage(data);
        },
        onMessage: (handler) => {
            const listener = (ev: MessageEvent) => {
                // RN injectJavaScript → window.dispatchEvent(MessageEvent({ data: string }))
                // 또는 다른 컨텍스트의 postMessage. string만 허용.
                if (typeof ev.data !== "string") return;
                handler(ev.data);
            };
            window.addEventListener("message", listener);
            return () => window.removeEventListener("message", listener);
        },
    };
}
