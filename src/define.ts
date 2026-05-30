import type { BridgeSchema, CommandDef, EventDef, RequestDef, Schema } from "./types";

// 각 factory는 minimal runtime metadata 객체를 반환.
// 두 모드만 — overload로 잠금:
//   1. 인자 없음 / timeout만 → void (검증 없음).
//   2. schema 제공 → 타입 추론 + 런타임 검증.
// `request<X>()` 같이 generic으로 타입을 만들어내는 우회는 컴파일 에러.

type RequestFactoryOptions = {
    timeout?: number | "none";
    payload?: Schema<unknown>;
    response?: Schema<unknown>;
};

type WithRequestSchema = { payload: Schema<unknown> } | { response: Schema<unknown> };

type InferReq<O> = O extends { payload: Schema<infer R> } ? R : void;
type InferRes<O> = O extends { response: Schema<infer R> } ? R : void;
type InferPayload<O> = O extends { payload: Schema<infer P> } ? P : void;

// REQUEST
export function request(): RequestDef<void, void>;
export function request(options: { timeout?: number | "none" }): RequestDef<void, void>;
export function request<O extends RequestFactoryOptions & WithRequestSchema>(
    options: O,
): RequestDef<InferReq<O>, InferRes<O>>;
export function request(options?: RequestFactoryOptions): RequestDef<unknown, unknown> {
    return { kind: "request", ...options };
}

// COMMAND
export function command(): CommandDef<void>;
export function command<O extends { payload: Schema<unknown> }>(
    options: O,
): CommandDef<InferReq<O>>;
export function command(options?: { payload?: Schema<unknown> }): CommandDef<unknown> {
    return { kind: "command", ...options };
}

// EVENT
export function event(): EventDef<void>;
export function event<O extends { payload: Schema<unknown> }>(
    options: O,
): EventDef<InferPayload<O>>;
export function event(options?: { payload?: Schema<unknown> }): EventDef<unknown> {
    return { kind: "event", ...options };
}

// defineContract: 입력을 그대로 반환. 제네릭 추론 통과를 위한 식별 함수.
export function defineContract<C extends BridgeSchema>(contract: C): C {
    return contract;
}

// 인스턴스 옵션 surface (timeout, logger 두 개로 한정 — §3.7.2).
export type Logger = Partial<{
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}>;

export type BridgeOptions = {
    defaultOptions?: { request?: { timeout?: number | "none" } };
    logger?: Logger;
};
