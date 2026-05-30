import type { BridgeOptions } from "../define";
import type { Envelope } from "../envelope";
import { PROTOCOL_VERSION, isValidEnvelope } from "../envelope";
import {
    BridgeDisposedError,
    BridgeHandlerError,
    BridgeTimeoutError,
    BridgeUnknownMessageError,
    BridgeValidationError,
} from "../errors";
import type { Transport } from "../transport/types";
import type {
    BridgeSchema,
    CommandKey,
    EventKey,
    PayloadOf,
    ReqOf,
    RequestKey,
    ResOf,
} from "../types";
import { SubscriberTable } from "./emitter";
import { createIdGenerator } from "./id";
import { PendingRequestTable } from "./pending";

const DEFAULT_TIMEOUT_MS = 30_000;

export type WebBridge<S extends BridgeSchema> = {
    request<K extends RequestKey<S>>(
        ...args: ReqOf<S[K]> extends void
            ? [name: K, payload?: undefined, opts?: { timeout?: number | "none" }]
            : [name: K, payload: ReqOf<S[K]>, opts?: { timeout?: number | "none" }]
    ): Promise<ResOf<S[K]>>;
    send<K extends CommandKey<S>>(
        ...args: ReqOf<S[K]> extends void ? [name: K] : [name: K, payload: ReqOf<S[K]>]
    ): void;
    on<K extends EventKey<S>>(name: K, handler: (payload: PayloadOf<S[K]>) => void): () => void;
    dispose(): void;
};

export function createWebBridge<S extends BridgeSchema>(
    transport: Transport,
    contract: S,
    options?: BridgeOptions,
): WebBridge<S> {
    const pending = new PendingRequestTable();
    const subscribers = new SubscriberTable();
    const nextId = createIdGenerator("r");
    const logger = options?.logger;
    const defaultTimeout = options?.defaultOptions?.request?.timeout ?? DEFAULT_TIMEOUT_MS;

    let disposed = false;

    const off = transport.onMessage((data) => {
        if (disposed) return;
        let parsed: unknown;
        try {
            parsed = JSON.parse(data);
        } catch {
            logger?.warn?.("[bridge:web] invalid JSON", data);
            return;
        }
        if (!isValidEnvelope(parsed)) {
            logger?.warn?.("[bridge:web] malformed envelope", parsed);
            return;
        }
        if (parsed.v !== PROTOCOL_VERSION) {
            logger?.warn?.("[bridge:web] unsupported protocolVersion", parsed.v);
            return;
        }
        dispatch(parsed);
    });

    function dispatch(envelope: Envelope): void {
        switch (envelope.kind) {
            case "response":
                pending.settle(envelope.id, (entry) => {
                    if (envelope.ok) {
                        entry.resolve(envelope.data);
                        return;
                    }
                    // VALIDATION_FAILED는 BridgeValidationError로 끌어올림 (caller가 instanceof로 분기 가능).
                    const { code, message } = envelope.error;
                    if (code === "VALIDATION_FAILED") {
                        entry.reject(new BridgeValidationError(message));
                    } else {
                        entry.reject(new BridgeHandlerError(code, message));
                    }
                });
                return;
            case "event": {
                const def = contract[envelope.name as keyof S];
                // contract에 없거나 kind가 event 아니면 drop + log.
                if (!def || def.kind !== "event") {
                    logger?.warn?.("[bridge:web] unknown event", envelope.name);
                    return;
                }
                // payload schema 있으면 들어온 페이로드 검증, 실패 시 drop + log.
                let payload = envelope.payload;
                if (def.payload) {
                    try {
                        payload = def.payload.parse(payload);
                    } catch (e) {
                        logger?.warn?.("[bridge:web] invalid event payload", envelope.name, e);
                        return;
                    }
                }
                subscribers.emit(envelope.name, payload);
                return;
            }
            case "request":
            case "command":
                logger?.warn?.("[bridge:web] received unexpected", envelope.kind);
                return;
        }
    }

    function doRequest(
        name: string,
        payload: unknown,
        opts: { timeout?: number | "none" } | undefined,
    ): Promise<unknown> {
        if (disposed) return Promise.reject(new BridgeDisposedError());
        const def = contract[name as keyof S];
        if (!def || def.kind !== "request") {
            return Promise.reject(new BridgeUnknownMessageError(name, "request", def?.kind));
        }
        // 나가는 payload 검증 (caller 버그를 호출 위치에서 즉시 감지).
        // parse 결과(transform/coerce 적용된 값)를 그대로 transport에 태움 — 양방향 일관.
        let outgoingPayload = payload;
        if (def.payload) {
            try {
                outgoingPayload = def.payload.parse(payload);
            } catch (e) {
                return Promise.reject(
                    new BridgeValidationError(`invalid request payload for "${name}"`, e),
                );
            }
        }
        const id = nextId();
        const contractTimeout = def.timeout;
        const timeout = opts?.timeout ?? contractTimeout ?? defaultTimeout;
        return new Promise((resolve, reject) => {
            // native가 UNKNOWN_MESSAGE 응답으로 거절한 경우 (handler 미바인딩 등) →
            // 나가는 쪽 path와 동일 클래스로 끌어올림 (caller가 instanceof로 일관 분기).
            const wrappedReject = (e: unknown): void => {
                if (e instanceof BridgeHandlerError && e.code === "UNKNOWN_MESSAGE") {
                    reject(new BridgeUnknownMessageError(name, "request"));
                    return;
                }
                reject(e as Error);
            };
            pending.add({
                id,
                // 들어온 응답 검증 (response schema 있으면). 실패 시 caller에게 reject.
                resolve: (data) => {
                    if (def.response) {
                        try {
                            resolve(def.response.parse(data));
                        } catch (e) {
                            reject(new BridgeValidationError(`invalid response for "${name}"`, e));
                        }
                        return;
                    }
                    resolve(data);
                },
                reject: wrappedReject,
                timeout,
                onTimeout: () => reject(new BridgeTimeoutError(id)),
            });
            transport.send(
                JSON.stringify({
                    v: PROTOCOL_VERSION,
                    kind: "request",
                    id,
                    name,
                    payload: outgoingPayload,
                }),
            );
        });
    }

    function doSend(name: string, payload: unknown): void {
        if (disposed) throw new BridgeDisposedError();
        const def = contract[name as keyof S];
        if (!def || def.kind !== "command") {
            logger?.warn?.("[bridge:web] unknown command", name);
            return;
        }
        // 나가는 command payload 검증 — parse 결과를 그대로 전송.
        let outgoingPayload = payload;
        if (def.payload) {
            try {
                outgoingPayload = def.payload.parse(payload);
            } catch (e) {
                throw new BridgeValidationError(`invalid command payload for "${name}"`, e);
            }
        }
        transport.send(
            JSON.stringify({
                v: PROTOCOL_VERSION,
                kind: "command",
                name,
                payload: outgoingPayload,
            }),
        );
    }

    return {
        request: ((...args: unknown[]) => {
            const [name, payload, opts] = args as [
                string,
                unknown?,
                { timeout?: number | "none" }?,
            ];
            return doRequest(name, payload, opts);
        }) as WebBridge<S>["request"],
        send: ((...args: unknown[]) => {
            const [name, payload] = args as [string, unknown?];
            doSend(name, payload);
        }) as WebBridge<S>["send"],
        on: ((name: string, handler: (p: unknown) => void) =>
            subscribers.on(name, handler)) as WebBridge<S>["on"],
        dispose: () => {
            if (disposed) return;
            disposed = true;
            pending.rejectAll(new BridgeDisposedError());
            subscribers.clear();
            off();
        },
    };
}
