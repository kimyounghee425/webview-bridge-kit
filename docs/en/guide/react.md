# Using it in React

This is the **web app running inside the WebView** (React). The web side sends requests/commands and subscribes to events pushed by native.

## You need the same contract

If web and native aren't in the same repo (monorepo), **you must define an identical contract on each side.** The web contract and the RN contract must match literally — if message names, kinds, or schemas drift, messages won't match at runtime. Extract it into a shared package or copy the file and keep it in sync.

## Install

```bash
npm install webview-bridge-kit
# react (>=18) already exists in your web app, no separate install
```

## createBridgeClient

Call `createBridgeClient` from `webview-bridge-kit/react` **once per app** to create typed Provider/hooks.

```ts
// app/bridge.ts
import { createBridgeClient } from 'webview-bridge-kit/react';
import { contract } from '@/shared/bridge-contract';

export const { BridgeProvider, useBridge, useBridgeEvent } = createBridgeClient(contract, {
  logger: import.meta.env.DEV ? console : undefined,
  defaultOptions: {
    request: { timeout: 3_000 },
  },
});
```

### Options

The second argument to `createBridgeClient(contract, options)`.

| Option                            | Type                       | Description                                                       |
| --------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `defaultOptions.request.timeout`  | `number \| 'none'`         | Default request timeout (ms). Defaults to 30_000. `'none'` disables it. |
| `logger`                          | `Partial<Console>`         | Records dropped messages (`debug`/`info`/`warn`/`error`). Optional. |

`contract` and `options` are frozen to their values at call time. (That's why the Provider takes no options prop — to avoid the options object changing during render.)

## Installing the Provider

Wrap `BridgeProvider` once at the top of your app. It creates the web bridge internally and disposes it on unmount.

```tsx
// App.tsx
import { BridgeProvider } from '@/app/bridge';

export function App() {
  return (
    <BridgeProvider>
      <AppRoutes />
    </BridgeProvider>
  );
}
```

## Sending request / command

Get the bridge in any child component with `useBridge`.

```tsx
import { useBridge } from '@/app/bridge';

export function LoginButton() {
  const bridge = useBridge();

  const onClick = async () => {
    // request — await the reply
    const { accessToken } = await bridge.request('KAKAO_LOGIN', undefined, { timeout: 'none' });
    await loginToServer(accessToken);
  };

  return <button onClick={onClick}>Kakao login</button>;
}
```

```ts
// request with a payload
const { token } = await bridge.request('GET_FCM_TOKEN');

// command — fire-and-forget, no await
bridge.send('OPEN_INSTAGRAM', { username: 'peelie' });
bridge.send('OPEN_CAMERA');
```

Omit the argument when the payload is `void`. Passing `{ timeout }` at call time overrides the contract/instance default.

## Receiving events (useBridgeEvent)

Subscribe to events pushed by native with `useBridgeEvent`. It subscribes on mount, unsubscribes on unmount, and always calls the latest render's handler — so no stale-closure worries.

```tsx
import { useBridgeEvent } from '@/app/bridge';

export function PhotoWatcher() {
  useBridgeEvent('PHOTO_TAKEN', ({ uri }) => {
    upload(uri);
  });

  return null;
}
```

::: warning You only receive events that arrive after you subscribe
Events emitted by native are not buffered. An event sent before the subscribing component mounts is lost. See [Using it in React Native](./react-native#events-are-not-buffered) for details.
:::
