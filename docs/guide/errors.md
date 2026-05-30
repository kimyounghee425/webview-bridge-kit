# 에러

`bridge.request(...)`는 실패하면 reject됩니다. 모든 에러는 `BridgeError`를 상속하므로 `instanceof`로 분기할 수 있습니다.

```ts
import {
  BridgeError,
  BridgeTimeoutError,
  BridgeValidationError,
  BridgeUnknownMessageError,
  BridgeHandlerError,
  BridgeDisposedError,
} from 'webview-bridge-kit';

try {
  const { token } = await bridge.request('GET_FCM_TOKEN');
} catch (e) {
  if (e instanceof BridgeTimeoutError) {
    // 타임아웃
  } else if (e instanceof BridgeValidationError) {
    // 스키마 검증 실패
  }
}
```

## 에러 종류

| 에러                        | 발생 시점                                                                 |
| --------------------------- | ------------------------------------------------------------------------- |
| `BridgeTimeoutError`        | request가 타임아웃 안에 응답을 못 받음                                     |
| `BridgeValidationError`     | 보낸 payload / 받은 response가 스키마 검증에 실패 (`send`/`emit`도 throw)  |
| `BridgeUnknownMessageError` | contract에 없는 request 호출, 또는 native가 handler를 못 찾아 거절한 경우 |
| `BridgeHandlerError`        | native의 request handler가 예외를 던진 경우 (`code`, `detail` 포함)        |
| `BridgeDisposedError`       | dispose 이후 호출, 또는 dispose 시 정리되는 pending request                |
| `BridgeError`               | 위 모든 에러의 베이스 클래스                                               |

## request가 아닌 경우

- **`bridge.send()`(command) · `bridge.emit()`(event)** — payload 스키마 검증에 실패하면 `BridgeValidationError`를 **throw**합니다(비동기 아님). contract에 없는 이름이면 throw하지 않고 `logger.warn` 후 drop합니다.
- **들어오는 메시지** — 깨진 JSON, 지원하지 않는 protocol version, contract에 없는 event/command, 검증 실패한 event/command payload는 모두 `logger.warn`(또는 `error`) 후 조용히 drop됩니다. 이때 `logger`를 설정해 두면 디버깅에 도움이 됩니다.

직접 호출한 request의 실패는 `logger`가 아니라 `try/catch`로 처리하세요.
