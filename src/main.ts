import { MegalisApp } from './game/app';

const root = document.getElementById('app');
if (!root) {
  throw new Error('#app element was not found');
}

new MegalisApp(root);
