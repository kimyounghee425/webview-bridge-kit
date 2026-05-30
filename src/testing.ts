import { createNativeBridge } from "./core/native";
import type { Handlers, NativeBridge } from "./core/native";
import { createWebBridge } from "./core/web";
import type { WebBridge } from "./core/web";
import { createMockTransportPair } from "./transport/mock-transport";
import type { BridgeSchema, CommandKey, ReqOf, RequestKey, ResOf } from "./types";

type PartialHandlers<S extends BridgeSchema> = Partial<
    {
        [K in RequestKey<S>]: (payload: ReqOf<S[K]>) => ResOf<S[K]> | Promise<ResOf<S[K]>>;
    } & {
        [K in CommandKey<S>]: (payload: ReqOf<S[K]>) => void | Promise<void>;
    }
>;

// 테스트 헬퍼: web ↔ native 한 쌍을 mock transport로 묶어서 반환.
// 프로덕션의 .bind와 다르게 partial handler 허용 — 등록 안 된 메시지를
// 호출하면 native가 UNKNOWN_MESSAGE로 자연 reject.
export function createTestBridge<S extends BridgeSchema>(
    contract: S,
    partialHandlers: PartialHandlers<S> = {},
): { web: WebBridge<S>; native: NativeBridge<S> } {
    const { web: webT, native: nativeT } = createMockTransportPair();
    const web = createWebBridge(webT, contract);
    // 테스트에서는 handler 누락 경로를 검증해야 하므로 full Handlers<S> 요구를 의도적으로 우회한다.
    const native = createNativeBridge(nativeT, contract).bind(partialHandlers as Handlers<S>);
    return { web, native };
}
