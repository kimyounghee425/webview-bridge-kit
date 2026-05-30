---
layout: home

hero:
  name: webview-bridge-kit
  text: Type-safe WebView ↔ React Native bridge
  tagline: One contract lets your web and native sides agree on message types at compile time — and validate them at runtime.
  actions:
    - theme: brand
      text: Get started
      link: /en/guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/kimyounghee425/webview-bridge-kit

features:
  - title: Type-safe
    details: Message names and payload / response types are inferred from the contract. Unknown messages or wrong payloads are compile errors.
  - title: Runtime validation
    details: Attach any schema with a parse(value) method (zod, valibot, arktype, or your own) for two-way validation. Schemas are optional.
  - title: Thin core + adapters
    details: The core has zero runtime dependencies; React / React Native adapters ship as separate entry points.
---
