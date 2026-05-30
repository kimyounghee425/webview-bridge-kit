import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNativeBridge } from "../src/core/native";
import { createWebBridge } from "../src/core/web";
import { command, defineContract, event, request } from "../src/define";
import {
    BridgeDisposedError,
    BridgeHandlerError,
    BridgeTimeoutError,
    BridgeUnknownMessageError,
    BridgeValidationError,
} from "../src/errors";
import { createTestBridge } from "../src/testing";
import { createMockTransportPair } from "../src/transport/mock-transport";
import type { Schema } from "../src/types";

// 검증 안 하지만 타입은 명시하고 싶은 테스트용 schema. 5줄짜리 fallback.
const passthrough = <T>(): Schema<T> => ({ parse: (v) => v as T });

const contract = defineContract({
    GET_TOKEN: request({ response: passthrough<{ token: string }>() }),
    ECHO: request({
        payload: passthrough<{ msg: string }>(),
        response: passthrough<{ msg: string }>(),
    }),
    OPEN_INSTAGRAM: command({ payload: passthrough<{ username: string }>() }),
    PHOTO_TAKEN: event({ payload: passthrough<{ uri: string }>() }),
    LONG_RPC: request({ response: passthrough<{ ok: boolean }>(), timeout: 50 }),
    NEVER_BOUND: request({ response: passthrough<{ ok: boolean }>() }),
});

// helper: queue a few microtask flushes so mock transport delivers in both directions
async function flush(): Promise<void> {
    for (let i = 0; i < 4; i++) await Promise.resolve();
}

describe("integration: web ↔ native via mock transport", () => {
    it("round-trips a request → response", async () => {
        const { web } = createTestBridge(contract, {
            GET_TOKEN: async () => ({ token: "abc" }),
        });
        await expect(web.request("GET_TOKEN")).resolves.toEqual({ token: "abc" });
    });

    it("passes payload through and returns handler result", async () => {
        const { web } = createTestBridge(contract, {
            ECHO: async ({ msg }) => ({ msg: msg.toUpperCase() }),
        });
        await expect(web.request("ECHO", { msg: "hi" })).resolves.toEqual({
            msg: "HI",
        });
    });

    it("rejects with BridgeUnknownMessageError when no handler is bound on native", async () => {
        const { web } = createTestBridge(contract, {});
        const err = await web.request("NEVER_BOUND").catch((e) => e);
        expect(err).toBeInstanceOf(BridgeUnknownMessageError);
        expect((err as BridgeUnknownMessageError).messageName).toBe("NEVER_BOUND");
        expect((err as BridgeUnknownMessageError).expectedKind).toBe("request");
    });

    it("rejects with HANDLER_ERROR when handler throws", async () => {
        const { web } = createTestBridge(contract, {
            GET_TOKEN: async () => {
                throw new Error("boom");
            },
        });
        const err = await web.request("GET_TOKEN").catch((e) => e);
        expect(err).toBeInstanceOf(BridgeHandlerError);
        expect(err.code).toBe("HANDLER_ERROR");
        expect(err.detail).toBe("boom");
    });

    it("command fires without response", async () => {
        const handler = vi.fn();
        const { web } = createTestBridge(contract, {
            OPEN_INSTAGRAM: handler,
        });
        web.send("OPEN_INSTAGRAM", { username: "peelie" });
        await flush();
        expect(handler).toHaveBeenCalledWith({ username: "peelie" });
    });

    it("command handler accepts sync void return", async () => {
        let captured: string | null = null;
        const { web } = createTestBridge(contract, {
            OPEN_INSTAGRAM: ({ username }: { username: string }): void => {
                captured = username;
            },
        });
        web.send("OPEN_INSTAGRAM", { username: "peelie" });
        await flush();
        expect(captured).toBe("peelie");
    });

    it("command handler accepts async void return", async () => {
        let captured: string | null = null;
        const { web } = createTestBridge(contract, {
            OPEN_INSTAGRAM: async ({ username }: { username: string }): Promise<void> => {
                captured = username;
            },
        });
        web.send("OPEN_INSTAGRAM", { username: "peelie" });
        await flush();
        expect(captured).toBe("peelie");
    });

    it("subscribes to events emitted from native", async () => {
        const { web, native } = createTestBridge(contract);
        const got = vi.fn();
        web.on("PHOTO_TAKEN", got);
        native.emit("PHOTO_TAKEN", { uri: "file://x" });
        await flush();
        expect(got).toHaveBeenCalledWith({ uri: "file://x" });
    });

    it("returns a cleanup function from on() that unsubscribes", async () => {
        const { web, native } = createTestBridge(contract);
        const handler = vi.fn();
        const off = web.on("PHOTO_TAKEN", handler);
        off();
        native.emit("PHOTO_TAKEN", { uri: "file://x" });
        await flush();
        expect(handler).not.toHaveBeenCalled();
    });

    describe("timeout", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it("rejects with BridgeTimeoutError when contract timeout elapses", async () => {
            const { web } = createTestBridge(contract, {
                LONG_RPC: () => new Promise(() => {}),
            });
            const p = web.request("LONG_RPC");
            vi.advanceTimersByTime(100);
            await expect(p).rejects.toBeInstanceOf(BridgeTimeoutError);
        });
    });

    it("dispose rejects pending requests with BridgeDisposedError", async () => {
        const { web } = createTestBridge(contract, {
            LONG_RPC: () => new Promise(() => {}),
        });
        const p = web.request("LONG_RPC");
        web.dispose();
        await expect(p).rejects.toBeInstanceOf(BridgeDisposedError);
    });

    it("dispose blocks subsequent requests", async () => {
        const { web } = createTestBridge(contract, {
            GET_TOKEN: async () => ({ token: "x" }),
        });
        web.dispose();
        await expect(web.request("GET_TOKEN")).rejects.toBeInstanceOf(BridgeDisposedError);
    });

    it("rejects before sending when requesting a name outside the contract", async () => {
        const { web: webT, native: nativeT } = createMockTransportPair();
        const nativeSeen = vi.fn();
        nativeT.onMessage(nativeSeen);
        const web = createWebBridge(webT, contract);

        const err = await (web.request as unknown as (name: string) => Promise<unknown>)(
            "MISSING",
        ).catch((e) => e);

        expect(err).toBeInstanceOf(BridgeUnknownMessageError);
        const bridgeError = err as BridgeUnknownMessageError;
        expect(bridgeError.messageName).toBe("MISSING");
        expect(bridgeError.expectedKind).toBe("request");
        await flush();
        expect(nativeSeen).not.toHaveBeenCalled();
    });

    it("warns and drops before sending when sending a command name outside the contract kind", async () => {
        const { web: webT, native: nativeT } = createMockTransportPair();
        const logger = { warn: vi.fn() };
        const nativeSeen = vi.fn();
        nativeT.onMessage(nativeSeen);
        const web = createWebBridge(webT, contract, { logger });

        expect(() => (web.send as unknown as (name: string) => void)("GET_TOKEN")).not.toThrow();
        await flush();
        expect(logger.warn).toHaveBeenCalledWith("[bridge:web] unknown command", "GET_TOKEN");
        expect(nativeSeen).not.toHaveBeenCalled();
    });

    it("warns and drops before sending when emitting an event name outside the contract", async () => {
        const { web: webT, native: nativeT } = createMockTransportPair();
        const logger = { warn: vi.fn() };
        const webSeen = vi.fn();
        webT.onMessage(webSeen);
        const native = createNativeBridge(nativeT, contract, { logger }).bind({} as never);

        expect(() =>
            (native.emit as unknown as (name: string) => void)("MISSING"),
        ).not.toThrow();
        await flush();
        expect(logger.warn).toHaveBeenCalledWith("[bridge:native] unknown event", "MISSING");
        expect(webSeen).not.toHaveBeenCalled();
    });
});

// raw envelope을 transport로 직접 주입해서 contract와 envelope.kind가 안 맞는 케이스 검증.
// TypeScript는 정상 사용을 막지만, 외부에서 raw JSON이 들어오면 런타임 검증이 막아야 함.
describe("envelope kind validation (runtime)", () => {
    function makeLogger() {
        return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    }

    it("native rejects request whose name is a command in the contract", async () => {
        const cmdHandler = vi.fn();
        const { web: webT, native: nativeT } = createMockTransportPair();
        createNativeBridge(nativeT, contract).bind({
            OPEN_INSTAGRAM: cmdHandler,
        } as never);
        const responses: string[] = [];
        webT.onMessage((data) => responses.push(data));

        webT.send(
            JSON.stringify({
                v: 1,
                kind: "request",
                id: "x-1",
                name: "OPEN_INSTAGRAM",
                payload: { username: "p" },
            }),
        );
        await flush();

        expect(cmdHandler).not.toHaveBeenCalled();
        expect(responses).toHaveLength(1);
        const resp = JSON.parse(responses[0]!);
        expect(resp.ok).toBe(false);
        expect(resp.error.code).toBe("UNKNOWN_MESSAGE");
    });

    it("native drops command whose name is a request in the contract", async () => {
        const reqHandler = vi.fn(async () => ({ token: "x" }));
        const logger = makeLogger();
        const { web: webT, native: nativeT } = createMockTransportPair();
        createNativeBridge(nativeT, contract, { logger }).bind({
            GET_TOKEN: reqHandler,
        } as never);
        const responses: string[] = [];
        webT.onMessage((data) => responses.push(data));

        webT.send(
            JSON.stringify({
                v: 1,
                kind: "command",
                name: "GET_TOKEN",
                payload: undefined,
            }),
        );
        await flush();

        expect(reqHandler).not.toHaveBeenCalled();
        expect(responses).toHaveLength(0);
        expect(logger.warn).toHaveBeenCalled();
    });

    it("web drops event whose name is a request in the contract", async () => {
        const logger = makeLogger();
        const { web: webT, native: nativeT } = createMockTransportPair();
        createWebBridge(webT, contract, { logger });

        nativeT.send(
            JSON.stringify({
                v: 1,
                kind: "event",
                name: "GET_TOKEN",
                payload: { token: "x" },
            }),
        );
        await flush();

        expect(logger.warn).toHaveBeenCalled();
    });
});

// schema 검증 — 양방향 8 위치 (request 4 + command 2 + event 2).
// bridge 코어는 zod에 의존하지 않으므로 테스트도 inline Schema 구현 사용.
describe("schema validation", () => {
    type Msg = { msg: string };
    const msgSchema: Schema<Msg> = {
        parse: (v) => {
            if (typeof v !== "object" || v === null) throw new Error("not object");
            const o = v as { msg?: unknown };
            if (typeof o.msg !== "string") throw new Error("msg must be string");
            return { msg: o.msg };
        },
    };

    const sContract = defineContract({
        ECHO: request({ payload: msgSchema, response: msgSchema }),
        GET_INFO: request({ response: msgSchema }),
        CMD: command({ payload: msgSchema }),
        EVT: event({ payload: msgSchema }),
    });

    function makeLogger() {
        return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    }

    // ① 나가는 request payload — caller에게 즉시 reject
    it("rejects request when outgoing payload fails schema", async () => {
        const { web } = createTestBridge(sContract, {
            ECHO: async (m) => m,
        });
        const bad = { msg: 123 } as unknown as Msg;
        await expect(web.request("ECHO", bad)).rejects.toBeInstanceOf(BridgeValidationError);
    });

    // ② 들어오는 request payload — VALIDATION_FAILED 응답
    it("native responds VALIDATION_FAILED when incoming request payload fails schema", async () => {
        const handler = vi.fn(async (m: Msg) => m);
        const { web: webT, native: nativeT } = createMockTransportPair();
        createNativeBridge(nativeT, sContract).bind({
            ECHO: handler,
            GET_INFO: async () => ({ msg: "x" }),
            CMD: () => {},
        });
        const responses: string[] = [];
        webT.onMessage((d) => responses.push(d));

        webT.send(
            JSON.stringify({
                v: 1,
                kind: "request",
                id: "x-1",
                name: "ECHO",
                payload: { msg: 123 },
            }),
        );
        await flush();

        expect(handler).not.toHaveBeenCalled();
        expect(responses).toHaveLength(1);
        const resp = JSON.parse(responses[0]!);
        expect(resp.ok).toBe(false);
        expect(resp.error.code).toBe("VALIDATION_FAILED");
    });

    // ③ 나가는 response — handler가 잘못된 모양 반환 시 VALIDATION_FAILED.
    // native가 보낸 VALIDATION_FAILED 응답을 web이 BridgeValidationError로 끌어올려서 reject.
    it("web rejects with BridgeValidationError when handler returns invalid response", async () => {
        const { web } = createTestBridge(sContract, {
            ECHO: async () => ({ msg: 123 }) as unknown as Msg,
            GET_INFO: async () => ({ msg: "x" }),
            CMD: () => {},
        });
        const err = await web.request("ECHO", { msg: "hi" }).catch((e) => e);
        expect(err).toBeInstanceOf(BridgeValidationError);
    });

    // ④ 들어오는 response — caller에게 BridgeValidationError reject
    it("web rejects with BridgeValidationError when incoming response fails schema", async () => {
        const { web: webT, native: nativeT } = createMockTransportPair();
        const web = createWebBridge(webT, sContract);

        let pendingId: string | null = null;
        nativeT.onMessage((d) => {
            const env = JSON.parse(d);
            if (env.kind === "request") pendingId = env.id;
        });

        const promise = web.request("GET_INFO");
        await flush();
        expect(pendingId).not.toBeNull();

        nativeT.send(
            JSON.stringify({
                v: 1,
                kind: "response",
                id: pendingId,
                ok: true,
                data: { msg: 123 },
            }),
        );
        await flush();

        await expect(promise).rejects.toBeInstanceOf(BridgeValidationError);
    });

    // ⑤ 나가는 event payload — emit 시 throw
    it("native emit throws BridgeValidationError when outgoing event payload is invalid", () => {
        const { native: nativeT } = createMockTransportPair();
        const native = createNativeBridge(nativeT, sContract).bind({
            ECHO: async (m) => m,
            GET_INFO: async () => ({ msg: "x" }),
            CMD: () => {},
        });
        const bad = { msg: 123 } as unknown as Msg;
        expect(() => native.emit("EVT", bad)).toThrow(BridgeValidationError);
    });

    // ⑥ 들어오는 event payload — drop + log
    it("web drops event when incoming event payload fails schema", async () => {
        const logger = makeLogger();
        const { web: webT, native: nativeT } = createMockTransportPair();
        const web = createWebBridge(webT, sContract, { logger });
        const sub = vi.fn();
        web.on("EVT", sub);

        nativeT.send(
            JSON.stringify({
                v: 1,
                kind: "event",
                name: "EVT",
                payload: { msg: 123 },
            }),
        );
        await flush();

        expect(sub).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    // 나가는 command payload — send 시 throw
    it("web send throws BridgeValidationError when outgoing command payload is invalid", () => {
        const { web } = createTestBridge(sContract);
        const bad = { msg: 123 } as unknown as Msg;
        expect(() => web.send("CMD", bad)).toThrow(BridgeValidationError);
    });

    // 들어오는 command payload — drop + log
    it("native drops command when incoming command payload fails schema", async () => {
        const logger = makeLogger();
        const cmdHandler = vi.fn();
        const { web: webT, native: nativeT } = createMockTransportPair();
        createNativeBridge(nativeT, sContract, { logger }).bind({
            ECHO: async (m) => m,
            GET_INFO: async () => ({ msg: "x" }),
            CMD: cmdHandler,
        });

        webT.send(
            JSON.stringify({
                v: 1,
                kind: "command",
                name: "CMD",
                payload: { msg: 123 },
            }),
        );
        await flush();

        expect(cmdHandler).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    // happy path: schema 통과 시 정상 동작
    it("validates and passes through when payloads match schemas", async () => {
        const { web } = createTestBridge(sContract, {
            ECHO: async (m) => m,
            GET_INFO: async () => ({ msg: "info" }),
            CMD: () => {},
        });
        await expect(web.request("ECHO", { msg: "hi" })).resolves.toEqual({ msg: "hi" });
        await expect(web.request("GET_INFO")).resolves.toEqual({ msg: "info" });
    });

    // outgoing 검증 시 parse 결과(transform 적용된 값)를 wire에 태우는지 검증.
    // schema가 단순 검증만 하면 input==output이라 차이 안 남 → trim하는 schema로 차이 확인.
    it("uses parsed value on outgoing (transform/coerce applied)", async () => {
        const trimSchema: Schema<Msg> = {
            parse: (v) => {
                if (typeof v !== "object" || v === null) throw new Error("not object");
                const o = v as { msg?: unknown };
                if (typeof o.msg !== "string") throw new Error("bad msg");
                return { msg: o.msg.trim() };
            },
        };
        const trimContract = defineContract({
            ECHO: request({ payload: trimSchema, response: trimSchema }),
        });

        const handlerSeen: { msg: string }[] = [];
        const { web } = createTestBridge(trimContract, {
            ECHO: async (m) => {
                handlerSeen.push(m);
                return { msg: `  ${m.msg}  ` }; // handler가 공백 포함해 반환
            },
        });

        const result = await web.request("ECHO", { msg: "  hi  " });
        // outgoing payload가 trim된 채로 native에 도달 → handler는 trim된 값 받음
        expect(handlerSeen[0]).toEqual({ msg: "hi" });
        // outgoing response도 native에서 trim된 후 web 도달
        expect(result).toEqual({ msg: "hi" });
    });
});
