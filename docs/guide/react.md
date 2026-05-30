# React 사용법

WebView **안에서 도는 웹 앱**(React) 쪽 사용법입니다. 웹은 request/command를 보내고, native가 보내는 event를 구독합니다.

## 동일한 contract가 필요합니다

웹과 네이티브가 같은 저장소(모노레포)가 아니라면, **양쪽에 동일한 contract를 각각 정의해 두어야 합니다.** 웹의 contract와 RN의 contract는 글자 그대로 같아야 합니다 — 메시지 이름·종류·스키마가 어긋나면 런타임에서 메시지가 매칭되지 않습니다. 공유 패키지로 빼거나 파일을 복사해 동기화하세요.

## 설치

```bash
npm install webview-bridge-kit
# react(>=18)는 웹 앱에 이미 있으므로 별도 설치 불필요
```

## createBridgeClient

`webview-bridge-kit/react`의 `createBridgeClient`를 **앱당 한 번** 호출해서 typed Provider/hooks를 만듭니다.

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

### 옵션

`createBridgeClient(contract, options)`의 두 번째 인자입니다.

| 옵션                              | 타입                          | 설명                                                         |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `defaultOptions.request.timeout`  | `number \| 'none'`            | request 기본 타임아웃(ms). 미지정 시 30_000. `'none'`이면 무제한. |
| `logger`                          | `Partial<Console>` 형태        | 메시지를 drop할 때 기록(`debug`/`info`/`warn`/`error`). 선택. |

`contract`와 `options`는 호출 시점 값으로 고정됩니다. (Provider가 options를 prop으로 받지 않는 이유 — 렌더 중 options 객체가 바뀌는 문제를 막기 위해.)

## Provider 설치

앱 최상단에서 `BridgeProvider`를 한 번만 감쌉니다. 내부에서 web bridge를 만들고 unmount 시 자동 정리합니다.

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

## request / command 보내기

하위 컴포넌트에서 `useBridge`로 bridge를 꺼냅니다.

```tsx
import { useBridge } from '@/app/bridge';

export function LoginButton() {
  const bridge = useBridge();

  const onClick = async () => {
    // request — 응답을 await
    const { accessToken } = await bridge.request('KAKAO_LOGIN', undefined, { timeout: 'none' });
    await loginToServer(accessToken);
  };

  return <button onClick={onClick}>카카오 로그인</button>;
}
```

```ts
// payload 있는 request
const { token } = await bridge.request('GET_FCM_TOKEN');

// command — fire-and-forget, await 불필요
bridge.send('OPEN_INSTAGRAM', { username: 'peelie' });
bridge.send('OPEN_CAMERA');
```

페이로드가 `void`이면 인자를 생략합니다. 호출 시점에 `{ timeout }`을 넘기면 contract/인스턴스 기본값을 덮어씁니다.

## event 받기 (useBridgeEvent)

native가 보내는 event는 `useBridgeEvent`로 구독합니다. mount 시 구독하고 unmount 시 자동 해제하며, handler는 항상 최신 렌더의 함수를 사용하므로 stale closure 걱정이 없습니다.

```tsx
import { useBridgeEvent } from '@/app/bridge';

export function PhotoWatcher() {
  useBridgeEvent('PHOTO_TAKEN', ({ uri }) => {
    upload(uri);
  });

  return null;
}
```

::: warning event는 구독한 뒤에 도착한 것만 받습니다
native가 emit한 event는 버퍼링되지 않습니다. 구독 컴포넌트가 마운트되기 전에 native가 보낸 event는 유실됩니다. 자세한 내용은 [React Native 사용법](./react-native#event는-버퍼링되지-않습니다)을 참고하세요.
:::
