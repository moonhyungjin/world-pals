import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 국기 SVG를 CSS/JS에 끼워 넣지 않고 파일로 분리해, 화면에 나온 국기만 내려받는다.
  build: { assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
