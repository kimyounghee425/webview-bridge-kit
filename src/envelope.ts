export const PROTOCOL_VERSION = 1 as const;

export type EnvelopeBase = { v: typeof PROTOCOL_VERSION };

export type RequestEnvelope = EnvelopeBase & {
    kind: "request";
    id: string;
    name: string;
    payload: unknown;
};

export type ResponseSuccessEnvelope = EnvelopeBase & {
    kind: "response";
    id: string;
    ok: true;
    data: unknown;
};

export type ResponseErrorEnvelope = EnvelopeBase & {
    kind: "response";
    id: string;
    ok: false;
    error: { message: string; code: string };
};

export type CommandEnvelope = EnvelopeBase & {
    kind: "command";
    name: string;
    payload: unknown;
};

export type EventEnvelope = EnvelopeBase & {
    kind: "event";
    name: string;
    payload: unknown;
};

export type Envelope =
    | RequestEnvelope
    | ResponseSuccessEnvelope
    | ResponseErrorEnvelope
    | CommandEnvelope
    | EventEnvelope;

const ENVELOPE_KINDS = new Set(["request", "response", "command", "event"]);

export function isValidEnvelope(value: unknown): value is Envelope {
    if (typeof value !== "object" || value === null) return false;
    const e = value as Record<string, unknown>;
    if (e.v !== PROTOCOL_VERSION) return false;
    if (typeof e.kind !== "string" || !ENVELOPE_KINDS.has(e.kind)) return false;

    switch (e.kind) {
        case "request":
            return typeof e.id === "string" && typeof e.name === "string";
        case "response": {
            if (typeof e.id !== "string") return false;
            if (e.ok === true) return true;
            if (e.ok === false) {
                if (typeof e.error !== "object" || e.error === null) return false;
                const err = e.error as Record<string, unknown>;
                return typeof err.message === "string" && typeof err.code === "string";
            }
            return false;
        }
        case "command":
        case "event":
            return typeof e.name === "string";
        default:
            return false;
    }
}
