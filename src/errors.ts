export class BridgeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BridgeError";
    }
}

export class BridgeTimeoutError extends BridgeError {
    readonly id: string;
    constructor(id: string) {
        super(`bridge request (id=${id}) timed out`);
        this.name = "BridgeTimeoutError";
        this.id = id;
    }
}

export class BridgeHandlerError extends BridgeError {
    readonly code: string;
    readonly detail: string;
    constructor(code: string, detail: string) {
        super(`bridge handler failed: ${code} — ${detail}`);
        this.name = "BridgeHandlerError";
        this.code = code;
        this.detail = detail;
    }
}

export class BridgeDisposedError extends BridgeError {
    constructor() {
        super("bridge instance was disposed");
        this.name = "BridgeDisposedError";
    }
}

export type BridgeMessageKind = "request" | "command" | "event";

export class BridgeUnknownMessageError extends BridgeError {
    readonly messageName: string;
    readonly expectedKind: BridgeMessageKind;
    readonly actualKind?: string;

    constructor(messageName: string, expectedKind: BridgeMessageKind, actualKind?: string) {
        super(
            actualKind
                ? `bridge message "${messageName}" is ${actualKind}, expected ${expectedKind}`
                : `unknown bridge ${expectedKind}: "${messageName}"`,
        );
        this.name = "BridgeUnknownMessageError";
        this.messageName = messageName;
        this.expectedKind = expectedKind;
        this.actualKind = actualKind;
    }
}

// schema.parse 실패 시 발생. cause에 원본 검증기 에러(예: ZodError)가 담김.
// caller가 instanceof로 timeout 등과 구분 가능 — 검증 실패는 재시도 무의미.
export class BridgeValidationError extends BridgeError {
    readonly cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "BridgeValidationError";
        this.cause = cause;
    }
}
