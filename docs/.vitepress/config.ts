import { defineConfig } from 'vitepress';

const REPO = 'https://github.com/kimyounghee425/webview-bridge-kit';

export default defineConfig({
  // GitHub Pages: https://kimyounghee425.github.io/webview-bridge-kit/
  base: '/webview-bridge-kit/',
  title: 'webview-bridge-kit',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,

  head: [
    ['meta', { name: 'theme-color', content: '#3c8772' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'webview-bridge-kit' }],
  ],

  themeConfig: {
    socialLinks: [{ icon: 'github', link: REPO }],
    search: { provider: 'local' },
  },

  locales: {
    root: {
      label: '한국어',
      lang: 'ko-KR',
      description: 'WebView와 React Native 호스트 사이의 타입 안전한 RPC + pub/sub 브릿지',
      themeConfig: {
        nav: [
          { text: '가이드', link: '/guide/introduction', activeMatch: '/guide/' },
          { text: 'npm', link: 'https://www.npmjs.com/package/webview-bridge-kit' },
        ],
        sidebar: {
          '/guide/': [
            {
              text: '가이드',
              items: [
                { text: '소개', link: '/guide/introduction' },
                { text: 'Contract 정의', link: '/guide/contract' },
                { text: 'React 사용법', link: '/guide/react' },
                { text: 'React Native 사용법', link: '/guide/react-native' },
                { text: '에러', link: '/guide/errors' },
              ],
            },
          ],
        },
        docFooter: { prev: '이전', next: '다음' },
        outline: { label: '이 페이지' },
        lastUpdated: { text: '마지막 수정' },
        returnToTopLabel: '맨 위로',
        editLink: {
          pattern: `${REPO}/edit/main/docs/:path`,
          text: 'GitHub에서 이 페이지 수정',
        },
      },
    },

    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      description: 'Type-safe RPC + pub/sub bridge between a WebView and its React Native host',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/introduction', activeMatch: '/en/guide/' },
          { text: 'npm', link: 'https://www.npmjs.com/package/webview-bridge-kit' },
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Introduction', link: '/en/guide/introduction' },
                { text: 'Defining a contract', link: '/en/guide/contract' },
                { text: 'Using it in React', link: '/en/guide/react' },
                { text: 'Using it in React Native', link: '/en/guide/react-native' },
                { text: 'Errors', link: '/en/guide/errors' },
              ],
            },
          ],
        },
        editLink: {
          pattern: `${REPO}/edit/main/docs/:path`,
          text: 'Edit this page on GitHub',
        },
      },
    },
  },
});
