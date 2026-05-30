import type { BridgeOptions } from '../define';
import type { Envelope } from '../envelope';
import { PROTOCOL_VERSION, isValidEnvelope } from '../envelope';
import { BridgeDisposedError, BridgeValidationError } from '../errors';
import type { Transport } from '../transport/types';
import type {
  BridgeSchema,
  CommandKey,
  EventKey,
  PayloadOf,
  ReqOf,
  RequestKey,
  ResOf,
} from '../types';

type RequestHandler<Req, Res> = (payload: Req) => Res | Promise<Res>;
type CommandHandler<Req> = (payload: Req) => void | Promise<void>;
type RuntimeHandler = (payload: unknown) => unknown;
type RuntimeHandlers = Record<string, RuntimeHandler>;

// .bind 인자 타입 — contract의 모든 request/command 키 강제.
// 누락 / 추가 / 시그니처 어긋남 모두 컴파일 에러.
// request는 응답 필요 → Res 강제. command는 응답 없음 → void 허용 (sync도, async도 OK).
export type Handlers<S extends BridgeSchema> = {
  [K in RequestKey<S>]: RequestHandler<ReqOf<S[K]>, ResOf<S[K]>>;
} & {
  [K in CommandKey<S>]: CommandHandler<ReqOf<S[K]>>;
};

export type NativeBridge<S extends BridgeSchema> = {
  emit<K extends EventKey<S>>(
    ...args: PayloadOf<S[K]> extends void ? [name: K] : [name: K, payload: PayloadOf<S[K]>]
  ): void;
  dispose(): void;
};

export type UnboundNativeBridge<S extends BridgeSchema> = {
  bind(handlers: Handlers<S>): NativeBridge<S>;
};

export function createNativeBridge<S extends BridgeSchema>(
  transport: Transport,
  contract: S,
  options?: BridgeOptions,
): UnboundNativeBridge<S> {
  const logger = options?.logger;
  let handlers: RuntimeHandlers | null = null;
  let disposed = false;

  const off = transport.onMessage((data) => {
    if (disposed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      logger?.warn?.('[bridge:native] invalid JSON', data);
      return;
    }
    if (!isValidEnvelope(parsed)) {
      logger?.warn?.('[bridge:native] malformed envelope', parsed);
      return;
    }
    if (parsed.v !== PROTOCOL_VERSION) {
      logger?.warn?.('[bridge:native] unsupported protocolVersion', parsed.v);
      return;
    }
    void dispatch(parsed);
  });

  async function dispatch(envelope: Envelope): Promise<void> {
    switch (envelope.kind) {
      case 'request': {
        const { id, name, payload } = envelope;
        const def = contract[name as keyof S];
        const handler = handlers?.[name];
        // contract에 이름이 없거나 / kind가 request가 아니거나 / handler 미바인딩 → 거절.
        // 셋 다 web 입장에선 "이 이름은 처리 못함" 동일 사실. UNKNOWN_MESSAGE로 통합.
        if (!def || def.kind !== 'request' || !handler) {
          transport.send(
            JSON.stringify({
              v: PROTOCOL_VERSION,
              kind: 'response',
              id,
              ok: false,
              error: {
                code: 'UNKNOWN_MESSAGE',
                message: `no handler for "${name}"`,
              },
            }),
          );
          return;
        }
        // 들어온 payload 검증 (schema 있을 때).
        let validatedPayload = payload;
        if (def.payload) {
          try {
            validatedPayload = def.payload.parse(payload);
          } catch (e) {
            logger?.warn?.('[bridge:native] invalid request payload', name, e);
            transport.send(
              JSON.stringify({
                v: PROTOCOL_VERSION,
                kind: 'response',
                id,
                ok: false,
                error: {
                  code: 'VALIDATION_FAILED',
                  message: `invalid payload for "${name}"`,
                },
              }),
            );
            return;
          }
        }
        try {
          const data = await handler(validatedPayload);
          // 나가는 response 검증 (handler 결과가 schema와 안 맞으면 native 코드 버그).
          let validatedData = data;
          if (def.response) {
            try {
              validatedData = def.response.parse(data);
            } catch (e) {
              logger?.error?.('[bridge:native] invalid response', name, e);
              transport.send(
                JSON.stringify({
                  v: PROTOCOL_VERSION,
                  kind: 'response',
                  id,
                  ok: false,
                  error: {
                    code: 'VALIDATION_FAILED',
                    message: `invalid response for "${name}"`,
                  },
                }),
              );
              return;
            }
          }
          transport.send(
            JSON.stringify({
              v: PROTOCOL_VERSION,
              kind: 'response',
              id,
              ok: true,
              data: validatedData,
            }),
          );
        } catch (e) {
          const err = e as { message?: string };
          transport.send(
            JSON.stringify({
              v: PROTOCOL_VERSION,
              kind: 'response',
              id,
              ok: false,
              error: {
                code: 'HANDLER_ERROR',
                message: err?.message ?? 'unknown error',
              },
            }),
          );
        }
        return;
      }
      case 'command': {
        const { name, payload } = envelope;
        const def = contract[name as keyof S];
        const handler = handlers?.[name];
        // command는 응답 채널이 없음 → drop + log.
        if (!def || def.kind !== 'command' || !handler) {
          logger?.warn?.('[bridge:native] unknown command', name);
          return;
        }
        // 들어온 command payload 검증 (실패 시 drop + log).
        let validatedPayload = payload;
        if (def.payload) {
          try {
            validatedPayload = def.payload.parse(payload);
          } catch (e) {
            logger?.warn?.('[bridge:native] invalid command payload', name, e);
            return;
          }
        }
        try {
          await handler(validatedPayload);
        } catch (e) {
          logger?.error?.('[bridge:native] command handler threw', name, e);
        }
        return;
      }
      case 'response':
      case 'event':
        logger?.warn?.('[bridge:native] received unexpected', envelope.kind);
        return;
    }
  }

  function doEmit(name: string, payload: unknown): void {
    if (disposed) throw new BridgeDisposedError();
    const def = contract[name as keyof S];
    if (!def || def.kind !== 'event') {
      logger?.warn?.('[bridge:native] unknown event', name);
      return;
    }
    // 나가는 event payload 검증 — parse 결과를 그대로 전송 (양방향 일관).
    let outgoingPayload = payload;
    if (def.payload) {
      try {
        outgoingPayload = def.payload.parse(payload);
      } catch (e) {
        throw new BridgeValidationError(`invalid event payload for "${name}"`, e);
      }
    }
    transport.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        kind: 'event',
        name,
        payload: outgoingPayload,
      }),
    );
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    handlers = null;
    off();
  }

  return {
    bind(boundHandlers: Handlers<S>): NativeBridge<S> {
      handlers = boundHandlers as RuntimeHandlers;
      return {
        emit: ((...args: unknown[]) => {
          const [name, payload] = args as [string, unknown?];
          doEmit(name, payload);
        }) as NativeBridge<S>['emit'],
        dispose,
      };
    },
  };
}
