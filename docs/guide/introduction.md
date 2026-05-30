# 소개

`webview-bridge-kit`은 **WebView 안의 웹 앱**과 그것을 감싸는 **React Native 호스트** 사이에서 타입 안전하게 메시지를 주고받기 위한 브릿지입니다.

웹과 네이티브가 **하나의 contract**를 함께 사용해서, 메시지 이름·페이로드·응답 타입을 컴파일 타임에 맞추고, 스키마를 붙이면 런타임에서도 검증합니다. WebView의 `postMessage` / `injectJavaScript` 위에 얇은 RPC + pub/sub 레이어를 올린 형태입니다.

## 메시지 세 종류

브릿지가 다루는 메시지는 다음 세 가지뿐입니다.

| 종류        | 방향         | 응답 | 용도                              |
| ----------- | ------------ | ---- | --------------------------------- |
| **request** | web → native | O    | 응답이 필요한 호출 (로그인, 토큰 조회 등) |
| **command** | web → native | X    | 응답이 필요 없는 명령 (화면 열기, 로그 전송 등) |
| **event**   | native → web | X    | 네이티브에서 웹으로 보내는 알림 (딥링크, 앱 상태 등) |

- **request** 는 `Promise`를 반환하고, 네이티브 handler의 반환값으로 resolve됩니다.
- **command** 는 fire-and-forget. 보내고 끝납니다.
- **event** 는 네이티브가 웹으로 push합니다. 웹은 구독(subscribe)해서 받습니다.

다음 단계에서 이 세 종류를 [Contract로 정의](./contract)하고, [React](./react) · [React Native](./react-native) 양쪽에서 어떻게 쓰는지 살펴봅니다.
