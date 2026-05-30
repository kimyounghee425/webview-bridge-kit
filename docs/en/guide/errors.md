# Errors

`bridge.request(...)` rejects on failure. Every error extends `BridgeError`, so you can branch with `instanceof`.

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
    // timed out
  } else if (e instanceof BridgeValidationError) {
    // schema validation failed
  }
}
```

## Error types

| Error                       | When it happens                                                              |
| --------------------------- | ---------------------------------------------------------------------------- |
| `BridgeTimeoutError`        | A request didn't get a reply within its timeout                              |
| `BridgeValidationError`     | A sent payload / received response failed schema validation (`send`/`emit` throw too) |
| `BridgeUnknownMessageError` | Calling a request not in the contract, or native rejecting because it has no handler |
| `BridgeHandlerError`        | A native request handler threw (carries `code`, `detail`)                    |
| `BridgeDisposedError`       | Calling after dispose, or a pending request cleared during dispose           |
| `BridgeError`               | The base class of all of the above                                           |

## Beyond requests

- **`bridge.send()` (command) · `bridge.emit()` (event)** — **throw** `BridgeValidationError` (not async) if the payload fails schema validation. An unknown name doesn't throw; it's dropped after `logger.warn`.
- **Incoming messages** — broken JSON, an unsupported protocol version, an event/command not in the contract, or an event/command payload that fails validation are all dropped silently after `logger.warn` (or `error`). Setting a `logger` helps debugging here.

Handle failures of requests you call directly with `try/catch`, not the `logger`.
