# Contract 정의

Contract는 브릿지가 주고받을 메시지의 **단일 진실 공급원(single source of truth)** 입니다. 웹과 네이티브가 같은 contract를 import 해서, 양쪽의 타입이 자동으로 맞춰집니다.

## 기본 형태

`defineContract`로 메시지 맵을 감싸고, 각 메시지를 `request` / `command` / `event` factory로 선언합니다.

```ts
// shared/bridge-contract.ts
import { command, defineContract, event, request } from 'webview-bridge-kit';

export const contract = defineContract({
  // request: web → native, 응답 있음
  GET_FCM_TOKEN: request(),
  PING: request(),

  // command: web → native, 응답 없음
  OPEN_CAMERA: command(),

  // event: native → web
  APP_FOREGROUND: event(),
});

export type Contract = typeof contract;
```

이렇게만 해도 메시지 이름과 종류가 타입으로 고정됩니다. `bridge.request('OPEN_CAMERA')`처럼 종류가 안 맞으면 컴파일 에러입니다.

## 스키마로 타입 + 런타임 검증

각 factory에 `parse(value): T`를 가진 스키마를 넘기면 **payload / response 타입이 추론되고, 런타임에서도 양방향으로 검증**됩니다. 스키마는 선택 사항이며, 없으면 payload / response 타입은 `void`입니다.

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

- `request({ payload, response, timeout })` — `payload`는 web→native로 보내는 값, `response`는 native가 돌려주는 값. `timeout`은 이 request의 기본 타임아웃(ms 또는 `'none'`).
- `command({ payload })` — 보내는 값만.
- `event({ payload })` — native가 보내는 값만.

::: tip 스키마는 라이브러리에 매이지 않습니다
`{ parse(value: unknown): T }` 모양이면 무엇이든 됩니다 — zod, valibot, arktype, 또는 직접 만든 객체. 검증은 같은 입력에 같은 출력을 내도록 작성하세요(시간·랜덤이 섞인 transform은 피하는 게 안전합니다).
:::

## 모노레포가 아니라면

웹과 네이티브가 별도 저장소라면, **동일한 contract 파일을 양쪽에 각각 두어야 합니다.** 한쪽만 바꾸면 타입은 맞아 보여도 런타임에서 메시지가 어긋납니다. contract를 공유 패키지로 빼거나, 한 파일을 복사해 동기화하세요. 이 내용은 [React](./react#동일한-contract가-필요합니다) · [React Native](./react-native#동일한-contract가-필요합니다) 페이지에서 다시 짚습니다.
