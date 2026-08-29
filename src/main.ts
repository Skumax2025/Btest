/** L4: entry point. Nothing but wiring. */

import { App } from '@ui/app';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app container is missing from index.html');

new App(root).start();
