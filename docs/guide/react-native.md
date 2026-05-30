# React Native 사용법

WebView를 **띄우는 호스트**(React Native) 쪽 사용법입니다. native는 web → native request/command의 handler를 연결하고, native → web event를 `emit`합니다.

## 동일한 contract가 필요합니다

웹과 네이티브가 같은 저장소(모노레포)가 아니라면, **양쪽에 동일한 contract를 각각 정의해 두어야 합니다.** RN의 contract는 웹의 contract와 글자 그대로 같아야 합니다 — 메시지 이름·종류·스키마가 어긋나면 런타임에서 메시지가 매칭되지 않습니다. 공유 패키지로 빼거나 파일을 복사해 동기화하세요.

## 설치

```bash
npm install webview-bridge-kit
# WebView 호스트에는 react-native-webview가 필요합니다
npm install react-native-webview
```

`webview-bridge-kit`은 `react-native-webview`에 직접 의존하지 않고, `WebView` ref의 구조(`injectJavaScript`)만 사용합니다.

## useNativeBridge

`webview-bridge-kit/react-native`의 `useNativeBridge`로 handler를 연결하고 `bridge`/`pushMessage`를 받습니다.

```tsx
import { useRef } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNativeBridge } from 'webview-bridge-kit/react-native';
import { contract } from './bridge-contract';

export default function App() {
  const ref = useRef<WebView>(null);

  const { bridge, pushMessage } = useNativeBridge(ref, contract, {
    // request handler — 반환값이 web의 응답이 됩니다 (async OK)
    GET_FCM_TOKEN: async () => ({ token: await messaging().getToken() }),
    KAKAO_LOGIN: async () => kakaoLogin(),
    PING: () => {},

    // command handler — 반환값 없음
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

`contract`의 모든 request/command 키에 대한 handler가 **타입으로 강제**됩니다. 누락·오타·시그니처 불일치는 컴파일 에러입니다.

### 옵션

`useNativeBridge(ref, contract, handlers, options)`의 네 번째 인자입니다. (모양은 React의 [`createBridgeClient` 옵션](./react#옵션)과 동일)

| 옵션                              | 타입                  | 설명                                                  |
| --------------------------------- | --------------------- | ----------------------------------------------------- |
| `logger`                          | `Partial<Console>`    | 메시지 drop / handler throw 등을 기록. 선택.          |
| `defaultOptions.request.timeout`  | `number \| 'none'`    | native 쪽에선 거의 쓸 일 없음(타임아웃은 호출자=웹 책임). |

```tsx
import type { BridgeOptions } from 'webview-bridge-kit';

const bridgeOptions = { logger: console } satisfies BridgeOptions;
```

## pushMessage 연결 (필수)

`pushMessage`는 WebView의 `onMessage`로 받은 raw 문자열을 bridge에 넣어줍니다. **이 줄이 없으면 web → native 메시지가 handler까지 도달하지 않습니다.**

```tsx
<WebView ref={ref} onMessage={(e) => pushMessage(e.nativeEvent.data)} />
```

## event 보내기 (bridge.emit)

native → web event는 `bridge.emit`으로 보냅니다. payload 타입은 contract에서 추론되며, `void` event는 인자를 생략합니다.

```tsx
bridge.emit('PHOTO_TAKEN', { uri: photo.uri });

AppState.addEventListener('change', (state) => {
  if (state === 'active') bridge.emit('APP_FOREGROUND');
});
```

### event는 버퍼링되지 않습니다

`emit`은 fire-and-forget입니다. 웹이 해당 event를 **구독하기 전에** native가 emit하면 그 event는 **아무 로그 없이 조용히 버려집니다** — contract에 정의된 event라도 그 순간 `useBridgeEvent` 구독자가 없으면 사라집니다(`logger.warn`은 contract에 *없는* event일 때만 찍힙니다). 따라서 다음 두 조건이 갖춰진 뒤에 emit해야 합니다.

1. WebView 로드가 끝나 웹 bridge가 살아 있다 (`onLoadEnd`).
2. 해당 event를 듣는 컴포넌트가 마운트되어 `useBridgeEvent` 구독이 등록됐다.

딥링크처럼 "앱이 켜지자마자" 도착하는 값은, 웹이 준비될 때까지 기다렸다가 emit합니다.

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

    // WebView가 뜬 직후엔 아직 useBridgeEvent 구독 전일 수 있어 약간 대기.
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

::: tip 더 견고한 방법
타이머 대신 "웹 준비 완료"를 알리는 command(예: 웹이 마운트 직후 `bridge.send('WEB_READY')`)를 두고, 그 handler 안에서 emit하면 타이밍에 의존하지 않습니다.
:::
