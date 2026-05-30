# Introduction

`webview-bridge-kit` is a bridge for passing messages, type-safely, between a **web app running inside a WebView** and the **React Native host** that wraps it.

Both sides share **a single contract**, so message names, payloads, and response types line up at compile time — and, if you attach schemas, they are validated at runtime too. It's a thin RPC + pub/sub layer on top of the WebView's `postMessage` / `injectJavaScript`.

## The three message kinds

The bridge deals with exactly three kinds of messages.

| Kind        | Direction    | Reply | Use for                                              |
| ----------- | ------------ | ----- | ---------------------------------------------------- |
| **request** | web → native | yes   | Calls that need a response (login, fetch a token)    |
| **command** | web → native | no    | Fire-and-forget orders (open a screen, send a log)   |
| **event**   | native → web | no    | Notifications pushed from native (deep links, app state) |

- **request** returns a `Promise` that resolves with the native handler's return value.
- **command** is fire-and-forget. You send it and move on.
- **event** is pushed from native to web. The web side subscribes to receive them.

Next, [define these in a contract](./contract), then see how to use them in [React](./react) and [React Native](./react-native).
