<script setup lang="ts">
const repo = 'kimyounghee425/webview-bridge-kit';
</script>

<template>
  <a
    class="vbk-star"
    :href="`https://github.com/${repo}`"
    target="_blank"
    rel="noreferrer"
    aria-label="Star webview-bridge-kit on GitHub"
  >
    <svg class="vbk-star__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"
      />
    </svg>
    <span class="vbk-star__label">Star</span>
  </a>
</template>

<style scoped>
.vbk-star {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  margin: 0 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-soft);
  transition: border-color 0.25s, background-color 0.25s;
}

.vbk-star:hover {
  border-color: var(--vp-c-brand-1);
  background-color: var(--vp-c-bg-mute);
}

.vbk-star__icon {
  color: #e3b341;
}

/* 모바일 좁은 화면에선 숨김 (햄버거 메뉴와 겹침 방지) */
@media (max-width: 768px) {
  .vbk-star {
    display: none;
  }
}
</style>
