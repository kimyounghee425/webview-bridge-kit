# Using it in React Native

This is the **host that mounts the WebView** (React Native). Native wires up handlers for web → native requests/commands, and `emit`s native → web events.

## You need the same contract

If web and native aren't in the same repo (monorepo), **you must define an identical contract on each side.** The RN contract must match the web contract literally — if message names, kinds, or schemas drift, messages won't match at runtime. Extract it into a shared package or copy the file and keep it in sync.

## Install

```bash
npm install webview-bridge-kit
# the WebView host needs react-native-webview
npm install react-native-webview
```

`webview-bridge-kit` doesn't depend on `react-native-webview` directly — it only uses the structure of the `WebView` ref (`injectJavaScript`).

## useNativeBridge

Wire up handlers with `useNativeBridge` from `webview-bridge-kit/react-native`, and get back `bridge` / `pushMessage`.

```tsx
import { useRef } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNativeBridge } from 'webview-bridge-kit/react-native';
import { contract } from './bridge-contract';

export default function App() {
  const ref = useRef<WebView>(null);

  const { bridge, pushMessage } = useNativeBridge(ref, contract, {
    // request handler — its return value becomes the web reply (async OK)
    GET_FCM_TOKEN: async () => ({ token: await messaging().getToken() }),
    KAKAO_LOGIN: async () => kakaoLogin(),
    PING: () => {},

    // command handler — no return value
    OPEN_CAMERA: () => router.push('/screen/CameraScreen'),
    OPEN_INSTAGRAM: ({ username }) =>
      Linking.openURL(`instagram://user?username=${username}`),
  });

  return (
    <WebView
      ref={ref}
      source={{ uri: 'https://your-web.app' }}
      onMessage={(e) => pushMessage(e.nativeEvent.data)}
    />
  );
}
```

A handler for every request/command key in the `contract` is **enforced by the type system**. Missing keys, typos, and signature mismatches are compile errors.

### Options

The fourth argument to `useNativeBridge(ref, contract, handlers, options)`. (Same shape as React's [`createBridgeClient` options](./react#options).)

| Option                            | Type                | Description                                                |
| --------------------------------- | ------------------- | ---------------------------------------------------------- |
| `logger`                          | `Partial<Console>`  | Records dropped messages / handler throws. Optional.       |
| `defaultOptions.request.timeout`  | `number \| 'none'`  | Rarely needed on native (timeouts are the caller's = web's job). |

```tsx
import type { BridgeOptions } from 'webview-bridge-kit';

const bridgeOptions = { logger: console } satisfies BridgeOptions;
```

## Wiring up pushMessage (required)

`pushMessage` feeds the raw string from the WebView's `onMessage` into the bridge. **Without this line, web → native messages never reach your handlers.**

```tsx
<WebView ref={ref} onMessage={(e) => pushMessage(e.nativeEvent.data)} />
```

## Sending events (bridge.emit)

Send native → web events with `bridge.emit`. The payload type is inferred from the contract; omit the argument for `void` events.

```tsx
bridge.emit('PHOTO_TAKEN', { uri: photo.uri });

AppState.addEventListener('change', (state) => {
  if (state === 'active') bridge.emit('APP_FOREGROUND');
});
```

### Events are not buffered

`emit` is fire-and-forget. If native emits **before** the web side subscribes to that event, the event is **dropped silently with no log** — even an event defined in the contract is lost if no `useBridgeEvent` subscriber exists at that moment (`logger.warn` only fires for events *not* in the contract). So emit only after both of these hold:

1. The WebView has finished loading and the web bridge is alive (`onLoadEnd`).
2. The component listening for that event has mounted and registered its `useBridgeEvent` subscription.

For values that arrive "right as the app opens" (like deep links), wait until the web side is ready, then emit.

```tsx
export default function HomeScreen() {
  const ref = useRef<WebView>(null);
  const [webReady, setWebReady] = useState(false);
  const url = Linking.useURL();

  const { bridge, pushMessage } = useNativeBridge(ref, contract, handlers, {
    logger: console,
  });

  useEffect(() => {
    if (!webReady || !url) return;
    const code = Linking.parse(url).queryParams?.code;
    if (typeof code !== 'string') return;

    // Right after the WebView loads, useBridgeEvent may not be subscribed yet — wait a bit.
    const t = setTimeout(() => bridge.emit('DEEP_LINK_INVITE', { code }), 800);
    return () => clearTimeout(t);
  }, [url, webReady, bridge]);

  return (
    <WebView
      ref={ref}
      source={{ uri: sourceUrl }}
      onMessage={(e) => pushMessage(e.nativeEvent.data)}
      onLoadEnd={() => setWebReady(true)}
    />
  );
}
```

::: tip A more robust approach
Instead of a timer, have the web side send a "web is ready" command (e.g. `bridge.send('WEB_READY')` right after mount) and emit inside that handler — no timing assumptions.
:::
