---
layout: home

hero:
  name: webview-bridge-kit
  text: 타입 안전한 WebView ↔ React Native 브릿지
  tagline: 하나의 contract로 웹과 네이티브가 메시지 타입을 컴파일 타임에 맞추고 런타임에서도 검증합니다.
  actions:
    - theme: brand
      text: 시작하기
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/kimyounghee425/webview-bridge-kit

features:
  - title: 타입 안전
    details: contract에서 메시지 이름과 payload / response 타입이 추론됩니다. 없는 메시지나 잘못된 페이로드는 컴파일 에러.
  - title: 런타임 검증
    details: parse(value)를 가진 스키마(zod, valibot, arktype, 자체 구현)를 붙이면 양방향으로 검증합니다. 스키마는 선택.
  - title: 얇은 코어 + 어댑터
    details: 코어는 런타임 의존성이 없고, React / React Native 어댑터는 별도 진입점으로 제공합니다.
---
