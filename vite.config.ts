import { defineConfig } from 'vite';

// GitHub Pages はリポジトリ名のサブパス配信 (https://<user>.github.io/<repo>/)
// になるため、base を相対パスにしてどのサブパスでも動くようにしている。
export default defineConfig({
  base: './',
});
