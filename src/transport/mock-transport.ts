import type { Transport } from "./types";

// 양방향 메모리 큐. createMockTransportPair() → web/native 한 쌍.
// 한쪽 send → microtask로 다른 쪽 onMessage handler 호출 (실제 transport 비동기 흉내).
export function createMockTransportPair(): {
    web: Transport;
    native: Transport;
} {
    type Listener = (data: string) => void;
    const webListeners = new Set<Listener>();
    const nativeListeners = new Set<Listener>();

    const web: Transport = {
        send: (data) => {
            queueMicrotask(() => {
                for (const l of nativeListeners) l(data);
            });
        },
        onMessage: (handler) => {
            webListeners.add(handler);
            return () => webListeners.delete(handler);
        },
    };

    const native: Transport = {
        send: (data) => {
            queueMicrotask(() => {
                for (const l of webListeners) l(data);
            });
        },
        onMessage: (handler) => {
            nativeListeners.add(handler);
            return () => nativeListeners.delete(handler);
        },
    };

    return { web, native };
}
