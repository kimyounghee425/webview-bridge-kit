import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import type { Theme } from 'vitepress';
import StarBadge from './StarBadge.vue';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      // 네비게이션 바 우측(소셜 링크 앞)에 GitHub 스타 버튼 삽입
      'nav-bar-content-after': () => h(StarBadge),
    });
  },
} satisfies Theme;
