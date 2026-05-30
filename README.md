# webview-bridge-kit

A type-safe bridge for passing messages between a web app inside a WebView and its React Native host.
Both sides import one contract, so message types line up at compile time and are validated at runtime.

**English** · [한국어](#한국어)

📖 **[Documentation](https://kimyounghee425.github.io/webview-bridge-kit/en/)** · [한국어 문서](https://kimyounghee425.github.io/webview-bridge-kit/)

| Kind        | Direction    | Reply | Use for                                          |
| ----------- | ------------ | ----- | ------------------------------------------------ |
| **request** | web → native | yes   | Calls that need a response (login, fetch a token) |
| **command** | web → native | no    | Fire-and-forget orders (open a screen, send logs) |
| **event**   | native → web | no    | Native → web notifications (deep links, app state) |

## Install

```bash
npm install webview-bridge-kit
# on a React Native host
npm install react-native-webview
```

The core has no runtime dependencies. A validation schema (zod, etc.) is optional. (Node >= 18, React >= 18)

## Quick example

**1. Contract — shared by web/native (keep it identical on both sides if you're not in a monorepo)**

```ts
// bridge-contract.ts
import { command, defineContract, event, request } from 'webview-bridge-kit';
import { z } from 'zod';

export const contract = defineContract({
  KAKAO_LOGIN: request({ response: z.object({ accessToken: z.string() }) }),
  OPEN_CAMERA: command(),
  PHOTO_TAKEN: event({ payload: z.object({ uri: z.string() }) }),
});
```

**2. Web (inside the WebView)**

```tsx
import { createBridgeClient } from 'webview-bridge-kit/react';
import { contract } from './bridge-contract';

export const { BridgeProvider, useBridge, useBridgeEvent } = createBridgeClient(contract);

// in a component
const bridge = useBridge();
const { accessToken } = await bridge.request('KAKAO_LOGIN');
bridge.send('OPEN_CAMERA');
useBridgeEvent('PHOTO_TAKEN', ({ uri }) => upload(uri));
```

**3. React Native (host)**

```tsx
import { useNativeBridge } from 'webview-bridge-kit/react-native';
import { contract } from './bridge-contract';

const ref = useRef<WebView>(null);
const { bridge, pushMessage } = useNativeBridge(ref, contract, {
  KAKAO_LOGIN: async () => ({ accessToken: await kakaoLogin() }),
  OPEN_CAMERA: () => router.push('/camera'),
});

// wiring pushMessage is required
<WebView ref={ref} onMessage={(e) => pushMessage(e.nativeEvent.data)} />;

// native → web event
bridge.emit('PHOTO_TAKEN', { uri });
```

## Docs

Install, defining a contract, React / React Native usage, options, and error handling are covered on the docs site.

→ **https://kimyounghee425.github.io/webview-bridge-kit/en/**

## License

[MIT](./LICENSE)

---

# 한국어

WebView 안의 웹 앱과 React Native 호스트 사이에서 타입 안전하게 메시지를 주고받는 브릿지입니다.
하나의 contract를 웹과 네이티브가 함께 import 해서, 메시지 타입을 컴파일 타임에 맞추고 런타임에서도 검증합니다.

[English](#webview-bridge-kit) · **한국어**

📖 **[문서 사이트](https://kimyounghee425.github.io/webview-bridge-kit/)** · [English docs](https://kimyounghee425.github.io/webview-bridge-kit/en/)

| 종류        | 방향         | 응답 | 용도                              |
| ----------- | ------------ | ---- | --------------------------------- |
| **request** | web → native | O    | 응답이 필요한 호출 (로그인, 토큰 조회) |
| **command** | web → native | X    | 응답이 필요 없는 명령 (화면 열기, 로그) |
| **event**   | native → web | X    | 네이티브 → 웹 알림 (딥링크, 앱 상태)   |

## 설치

```bash
npm install webview-bridge-kit
# React Native 호스트라면
npm install react-native-webview
```

코어는 런타임 의존성이 없습니다. 검증 스키마(zod 등)는 선택입니다. (Node >= 18, React >= 18)

## 빠른 예제

**1. Contract — 웹/네이티브가 공유 (모노레포가 아니면 양쪽에 동일하게 둡니다)**

```ts
// bridge-contract.ts
import { command, defineContract, event, request } from 'webview-bridge-kit';
import { z } from 'zod';

export const contract = defineContract({
  KAKAO_LOGIN: request({ response: z.object({ accessToken: z.string() }) }),
  OPEN_CAMERA: command(),
  PHOTO_TAKEN: event({ payload: z.object({ uri: z.string() }) }),
});
```

**2. Web (WebView 내부)**

```tsx
import { createBridgeClient } from 'webview-bridge-kit/react';
import { contract } from './bridge-contract';

export const { BridgeProvider, useBridge, useBridgeEvent } = createBridgeClient(contract);

// 컴포넌트에서
const bridge = useBridge();
const { accessToken } = await bridge.request('KAKAO_LOGIN');
bridge.send('OPEN_CAMERA');
useBridgeEvent('PHOTO_TAKEN', ({ uri }) => upload(uri));
```

**3. React Native (호스트)**

```tsx
import { useNativeBridge } from 'webview-bridge-kit/react-native';
import { contract } from './bridge-contract';

const ref = useRef<WebView>(null);
const { bridge, pushMessage } = useNativeBridge(ref, contract, {
  KAKAO_LOGIN: async () => ({ accessToken: await kakaoLogin() }),
  OPEN_CAMERA: () => router.push('/camera'),
});

// pushMessage 연결은 필수
<WebView ref={ref} onMessage={(e) => pushMessage(e.nativeEvent.data)} />;

// 네이티브 → 웹 event
bridge.emit('PHOTO_TAKEN', { uri });
```

## 문서

설치, Contract 정의, React / React Native 사용법, 옵션, 에러 처리는 문서 사이트에서 다룹니다.

→ **https://kimyounghee425.github.io/webview-bridge-kit/**

## License

[MIT](./LICENSE)
