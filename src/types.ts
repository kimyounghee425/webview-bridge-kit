// Minimal runtime metadata + phantom payload/response types.
// 각 factory는 { kind, ...schemas, ...options } 객체를 반환. 타입은 schema에서 추론 또는 phantom 필드.

// 외부 검증기(zod, valibot, arktype, 자체 구현 등)와 호환되는 최소 인터페이스.
// parse 성공 시 T 반환, 실패 시 throw.
export type Schema<T> = { parse(value: unknown): T };

export type RequestDef<Req = unknown, Res = unknown> = {
    kind: "request";
    timeout?: number | "none";
    payload?: Schema<Req>;
    response?: Schema<Res>;
    __req?: Req;
    __res?: Res;
};

export type CommandDef<Req = unknown> = {
    kind: "command";
    payload?: Schema<Req>;
    __req?: Req;
};

export type EventDef<Payload = unknown> = {
    kind: "event";
    payload?: Schema<Payload>;
    __payload?: Payload;
};

export type MessageDef = RequestDef | CommandDef | EventDef;

export type BridgeSchema = Record<string, MessageDef>;

// kind별 키 추출
export type RequestKey<S extends BridgeSchema> = {
    [K in keyof S]: S[K] extends RequestDef ? K : never;
}[keyof S];

export type CommandKey<S extends BridgeSchema> = {
    [K in keyof S]: S[K] extends CommandDef ? K : never;
}[keyof S];

export type EventKey<S extends BridgeSchema> = {
    [K in keyof S]: S[K] extends EventDef ? K : never;
}[keyof S];

// 페이로드/응답 타입 추출 — kind 디스크리미네이터 + phantom 필드.
// 같은 패턴 세 줄로 통일 → 가독성, 미래에 def 모양 바뀌어도 안 깨짐.
export type ReqOf<M> = M extends { kind: "request" | "command"; __req?: infer R } ? R : never;
export type ResOf<M> = M extends { kind: "request"; __res?: infer R } ? R : never;
export type PayloadOf<M> = M extends { kind: "event"; __payload?: infer P } ? P : never;
