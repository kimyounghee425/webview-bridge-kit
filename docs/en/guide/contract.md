# Defining a contract

The contract is the **single source of truth** for the messages your bridge exchanges. Web and native import the same contract, so both sides' types stay in sync automatically.

## Basic shape

Wrap a map of messages with `defineContract`, declaring each one with the `request` / `command` / `event` factories.

```ts
// shared/bridge-contract.ts
import { command, defineContract, event, request } from 'webview-bridge-kit';

export const contract = defineContract({
  // request: web → native, has a reply
  GET_FCM_TOKEN: request(),
  PING: request(),

  // command: web → native, no reply
  OPEN_CAMERA: command(),

  // event: native → web
  APP_FOREGROUND: event(),
});

export type Contract = typeof contract;
```

This alone locks message names and kinds into the type system. Calling `bridge.request('OPEN_CAMERA')` (wrong kind) is a compile error.

## Schemas for types + runtime validation

Pass a schema with a `parse(value): T` method to any factory and the **payload / response types are inferred, and validated at runtime in both directions**. Schemas are optional; without one, payload / response types are `void`.

```ts
import { z } from 'zod';
import { command, defineContract, event, request } from 'webview-bridge-kit';

const TokenSchema = z.object({ token: z.string() });
const KakaoLoginSchema = z.object({ accessToken: z.string() });
const UsernameSchema = z.object({ username: z.string() });
const UriSchema = z.object({ uri: z.string() });

export const contract = defineContract({
  GET_FCM_TOKEN: request({ response: TokenSchema }),
  KAKAO_LOGIN: request({ response: KakaoLoginSchema, timeout: 'none' }),
  PING: request(),

  OPEN_CAMERA: command(),
  OPEN_INSTAGRAM: command({ payload: UsernameSchema }),

  APP_FOREGROUND: event(),
  PHOTO_TAKEN: event({ payload: UriSchema }),
});
```

- `request({ payload, response, timeout })` — `payload` is sent web→native, `response` is what native returns. `timeout` is this request's default timeout (ms or `'none'`).
- `command({ payload })` — the sent value only.
- `event({ payload })` — the value native sends.

::: tip Schemas aren't tied to any library
Anything shaped like `{ parse(value: unknown): T }` works — zod, valibot, arktype, or your own object. Write validators that return the same output for the same input (avoid transforms with time / randomness).
:::

## If you're not in a monorepo

If web and native live in separate repos, **you must keep an identical contract on each side.** Change one only and the types still look fine while messages drift at runtime. Extract the contract into a shared package, or copy the file and keep it in sync. This is repeated on the [React](./react#you-need-the-same-contract) and [React Native](./react-native#you-need-the-same-contract) pages.
