import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
    'react-native': 'src/react-native.ts',
    testing: 'src/testing.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  target: 'es2020',
});
