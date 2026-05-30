export type {
    BridgeSchema,
    MessageDef,
    RequestDef,
    CommandDef,
    EventDef,
    RequestKey,
    CommandKey,
    EventKey,
    ReqOf,
    ResOf,
    PayloadOf,
    Schema,
} from "./types";

export type {
    Envelope,
    EnvelopeBase,
    RequestEnvelope,
    ResponseSuccessEnvelope,
    ResponseErrorEnvelope,
    CommandEnvelope,
    EventEnvelope,
} from "./envelope";
export { isValidEnvelope, PROTOCOL_VERSION } from "./envelope";

export { defineContract, request, command, event } from "./define";
export type { BridgeOptions, Logger } from "./define";

export {
    BridgeError,
    BridgeTimeoutError,
    BridgeHandlerError,
    BridgeDisposedError,
    BridgeUnknownMessageError,
    BridgeValidationError,
} from "./errors";
export type { BridgeMessageKind } from "./errors";

export { createWebBridge } from "./core/web";
export type { WebBridge } from "./core/web";

export { createNativeBridge } from "./core/native";
export type { NativeBridge, UnboundNativeBridge, Handlers } from "./core/native";

export type { Transport } from "./transport/types";
export { createMockTransportPair } from "./transport/mock-transport";
export { webTransport } from "./transport/web-transport";
export { rnTransport } from "./transport/rn-transport";
export type { RnTransport } from "./transport/rn-transport";
