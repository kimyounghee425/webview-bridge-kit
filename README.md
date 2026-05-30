# webview-bridge-kit

WebView 안의 웹 앱과 React Native 셸 사이에서 타입 안전하게 메시지를 주고받는 브릿지 패키지입니다.

| 종류        | 방향         | 용도                             |
| ----------- | ------------ | -------------------------------- |
| **request** | web → native | 응답이 필요한 호출               |
| **command** | web → native | 응답이 필요 없는 명령            |
| **event**   | native → web | 네이티브에서 웹으로 보내는 알림 |

## 기본 사용법

### 1. Contract 정의

웹과 네이티브가 같은 contract를 import해서 사용합니다. schema를 넣으면 TypeScript 타입 추론과 런타임 검증이 같이 동작합니다.
schema가 없으면 payload/response는 `void`입니다.

```ts
// shared/bridge-contract.ts
import { z } from 'zod';
import { command, defineContract, event, request } from 'webview-bridge-kit';

const TokenSchema = z.object({ token: z.string() });
const KakaoLoginSchema = z.object({ accessToken: z.string(), userId: z.string() });
const UsernameSchema = z.object({ username: z.string() });
const TimestampSchema = z.object({ timestamp: z.number() });
const UriSchema = z.object({ uri: z.string() });

export const contract = defineContract({
  GET_FCM_TOKEN: request({ response: TokenSchema }),
  KAKAO_LOGIN: request({ response: KakaoLoginSchema, timeout: 'none' }),
  PING: request(),

  OPEN_CAMERA: command(),
  OPEN_INSTAGRAM: command({ payload: UsernameSchema }),

  APP_FOREGROUND: event(),
  APP_RESUME: event({ payload: TimestampSchema }),
  PHOTO_TAKEN: event({ payload: UriSchema }),
});
```

schema는 `parse(value: unknown): T` 메서드를 가진 객체면 됩니다.

### 2. Web: BridgeClient 생성

웹 앱에서는 `createBridgeClient`를 한 번 호출해서 typed Provider/hooks를 만듭니다.

```ts
// app/bridge.ts
import { createBridgeClient } from 'webview-bridge-kit/react';
import { contract } from '@/shared/bridge-contract';

export const { BridgeProvider, useBridge, useBridgeEvent } = createBridgeClient(contract, {
  logger: import.meta.env.DEV ? console : undefined,
  defaultOptions: {
    request: { timeout: 30_000 },
  },
});
```

`contract`와 `options`는 `createBridgeClient`를 호출한 시점의 값으로 고정됩니다. 렌더 중 options 객체가 바뀌는 문제를 만들지 않기 위해 Provider prop으로 options를 받지 않습니다.

### 3. Web: Provider 설치

앱 최상단에서 `BridgeProvider`를 한 번만 감쌉니다.

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

`BridgeProvider`는 내부에서 web bridge를 만들고, unmount 시 자동으로 정리합니다.

### 4. Web: request/command/event 사용

하위 컴포넌트에서는 `useBridge`와 `useBridgeEvent`를 사용합니다.

```tsx
import { useBridge, useBridgeEvent } from '@/app/bridge';

export function CameraButton() {
  const bridge = useBridge();

  useBridgeEvent('PHOTO_TAKEN', ({ uri }) => {
    upload(uri);
  });

  return <button onClick={() => bridge.send('OPEN_CAMERA')}>Open camera</button>;
}
```

```ts
const { token } = await bridge.request('GET_FCM_TOKEN');
await bridge.request('KAKAO_LOGIN', undefined, { timeout: 'none' });

bridge.send('OPEN_INSTAGRAM', { username: 'peelie' });
bridge.send('OPEN_CAMERA');
```

`useBridgeEvent`는 mount 시 구독하고 unmount 시 자동으로 해제합니다. handler는 최신 렌더의 함수를 사용하므로 stale closure를 피하기 위해 직접 `ref`를 만들 필요가 없습니다.

페이로드가 `void`이면 인자를 생략합니다.

```ts
bridge.request('GET_FCM_TOKEN');
bridge.send('OPEN_CAMERA');
```

### 5. Native: handler 연결

네이티브에서는 `useNativeBridge`로 web → native request/command handler를 연결합니다.

```tsx
import { useRef } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNativeBridge } from 'webview-bridge-kit/react-native';
import { contract } from '@/shared/bridge-contract';

export default function App() {
  const ref = useRef<WebView>(null);

  const { bridge, pushMessage } = useNativeBridge(ref, contract, {
    GET_FCM_TOKEN: async () => ({ token: await messaging().getToken() }),
    KAKAO_LOGIN: async () => kakaoLogin(),
    PING: () => {},
    OPEN_CAMERA: () => router.push('/screen/CameraScreen'),
    OPEN_INSTAGRAM: ({ username }) =>
      Linking.openURL(`instagram://user?username=${username}`).catch(() =>
        Linking.openURL(`https://instagram.com/${username}`),
      ),
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

`pushMessage`는 WebView의 `onMessage`로 받은 raw string을 bridge에 전달합니다. 이 줄이 없으면 web → native 메시지가 native handler까지 도달하지 않습니다.

네이티브에서 웹으로 event를 보낼 때는 `bridge.emit`을 사용합니다.

```ts
bridge.emit('PHOTO_TAKEN', { uri: photo.uri });

AppState.addEventListener('change', (state) => {
  if (state === 'active') bridge.emit('APP_FOREGROUND');
});
```

## Options

`createBridgeClient`와 `useNativeBridge`는 같은 options 모양을 사용합니다.

```ts
type BridgeOptions = {
  defaultOptions?: {
    request?: {
      timeout?: number | 'none';
    };
  };
  logger?: Logger;
};
```

타임아웃은 호출 시점 > contract 정의 > 인스턴스 default 순서로 적용됩니다. 로그인, 카메라처럼 사용자 인터랙션이 길어질 수 있는 request는 `timeout: 'none'`을 사용할 수 있습니다.

```ts
await bridge.request('KAKAO_LOGIN', undefined, { timeout: 'none' });
```

`logger`는 브릿지가 메시지를 처리하다가 버리는 상황을 기록할 때 사용합니다.

- 깨진 JSON이 들어온 경우
- 지원하지 않는 protocol version이 들어온 경우
- contract에 없는 command/event가 들어온 경우
- command/event payload가 schema와 맞지 않아 drop된 경우
- native command handler가 throw한 경우

직접 호출한 request 실패는 `logger`가 아니라 `try/catch`로 처리합니다.

## 에러 처리

request는 실패하면 reject됩니다.

```ts
import {
  BridgeDisposedError,
  BridgeHandlerError,
  BridgeTimeoutError,
  BridgeUnknownMessageError,
  BridgeValidationError,
} from 'webview-bridge-kit';

try {
  await bridge.request('GET_FCM_TOKEN');
} catch (e) {
  if (e instanceof BridgeTimeoutError) {
    // request timeout
  }
  if (e instanceof BridgeValidationError) {
    // schema validation failed
  }
  if (e instanceof BridgeUnknownMessageError) {
    // contract에 없는 request 또는 native UNKNOWN_MESSAGE 응답
  }
  if (e instanceof BridgeHandlerError) {
    // native request handler가 throw한 경우
  }
  if (e instanceof BridgeDisposedError) {
    // dispose 이후 사용 또는 pending request 정리
  }
}
```

`bridge.send()`와 `bridge.emit()`에서 payload schema 검증이 실패하면 `BridgeValidationError`를 throw합니다. contract에 없는 command/event는 throw하지 않고 `logger.warn` 후 drop합니다.

## 런타임 검증

schema가 붙은 자리는 양방향으로 검증됩니다.

| 상황                         | request                              | command/event                 |
| ---------------------------- | ------------------------------------ | ----------------------------- |
| contract에 없는 이름 호출    | `BridgeUnknownMessageError` reject   | drop + `logger.warn`          |
| 내가 보낸 값이 schema와 다름 | `BridgeValidationError` reject       | `BridgeValidationError` throw |
| 상대가 잘못 보낸 메시지      | 응답 에러로 돌려주고 caller가 reject | drop + `logger.warn`          |

schema는 같은 입력에 같은 출력을 내도록 작성하세요. 시간/랜덤값이 섞인 transform은 피하는 것이 안전합니다.

## 테스트

테스트에서는 `webview-bridge-kit/testing`의 `createTestBridge`로 web/native bridge 한 쌍을 만들 수 있습니다.

```ts
import { createTestBridge } from 'webview-bridge-kit/testing';
import { contract } from '@/shared/bridge-contract';

const { web, native } = createTestBridge(contract, {
  GET_FCM_TOKEN: async () => ({ token: 'test-token' }),
  OPEN_CAMERA: () => {},
});

await expect(web.request('GET_FCM_TOKEN')).resolves.toEqual({ token: 'test-token' });

const handler = vi.fn();
web.on('PHOTO_TAKEN', handler);
native.emit('PHOTO_TAKEN', { uri: 'file://photo.jpg' });
```

테스트 helper는 handler를 부분적으로만 넘길 수 있습니다. 등록되지 않은 request를 호출하면 실제 native와 같은 방식으로 `BridgeUnknownMessageError`가 발생합니다.

## Public API

### `webview-bridge-kit`

- `defineContract`
- `request`
- `command`
- `event`
- request 에러 클래스들
- core low-level API

### `webview-bridge-kit/react`

- `createBridgeClient`
- `useWebBridge`
- `BridgeClient`
- `BridgeProviderProps`

### `webview-bridge-kit/react-native`

- `useNativeBridge`

### `webview-bridge-kit/testing`

- `createTestBridge`

## Low-level API

대부분의 웹 앱은 `createBridgeClient`를 사용하면 됩니다. React Context를 쓰지 않거나 transport를 직접 제어해야 할 때만 low-level API를 사용합니다.

```ts
import { createWebBridge, webTransport } from 'webview-bridge-kit';
import { contract } from '@/shared/bridge-contract';

const bridge = createWebBridge(webTransport(), contract);
```

```ts
import { createNativeBridge, rnTransport } from 'webview-bridge-kit';
import { contract } from '@/shared/bridge-contract';

const nativeBridge = createNativeBridge(rnTransport(ref), contract).bind(handlers);
```

React 컴포넌트 안에서 직접 web bridge 생명주기만 관리하고 싶다면 `useWebBridge`를 사용할 수 있습니다.

```tsx
import { useWebBridge } from 'webview-bridge-kit/react';

const bridge = useWebBridge(contract);
```
