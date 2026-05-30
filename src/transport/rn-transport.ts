import type { Transport } from "./types";

// react-native-webview의 WebView ref와 호환되는 minimal interface.
// 라이브러리가 react-native-webview에 직접 의존하지 않도록 구조적 타입만 요구.
type WebViewLike = {
    injectJavaScript: (script: string) => void;
};
type WebViewRefLike = { current: WebViewLike | null };

// RN(WebView 호스트) 측 transport.
// send: WebView로 inject — web 쪽 window.dispatchEvent로 도착.
// onMessage: 등록된 listener를 push 받기 위해 추가 메서드 pushMessage 노출.
//   사용자가 <WebView onMessage={(e) => transport.pushMessage(e.nativeEvent.data)} />로 wiring.
//   prop wiring을 자동화하는 wrapper 컴포넌트는 v2의 @peelie/bridge/react-native에서 제공.
export type RnTransport = Transport & {
    pushMessage: (data: string) => void;
};

export function rnTransport(webViewRef: WebViewRefLike): RnTransport {
    const listeners = new Set<(data: string) => void>();

    return {
        send: (data) => {
            // JSON.stringify로 quote/backslash escape — script injection 안전.
            const literal = JSON.stringify(data);
            webViewRef.current?.injectJavaScript(
                `window.dispatchEvent(new MessageEvent('message', { data: ${literal} })); true;`,
            );
        },
        onMessage: (handler) => {
            listeners.add(handler);
            return () => listeners.delete(handler);
        },
        pushMessage: (data) => {
            for (const l of listeners) l(data);
        },
    };
}
