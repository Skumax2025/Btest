/** L4: entry point. */
import { Canvas2DRenderer } from '@core/renderer';
import { Camera } from '@core/camera';
import { GameLoop, browserLoopOptions } from '@core/loop';
import { InputDevice } from '@core/input';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app missing');

const canvas = document.createElement('canvas');
app.appendChild(canvas);

const renderer = new Canvas2DRenderer(canvas, 2);
const camera = new Camera();
const input = new InputDevice(
  {
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
  },
  { up: 'up', down: 'down', left: 'left', right: 'right' },
);
input.attach(canvas, window);

const resize = (): void => {
  renderer.resize(window.innerWidth, window.innerHeight);
  camera.resize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', resize);
resize();

const player = { x: 0, y: 0 };
const loop = new GameLoop(browserLoopOptions(1000 / 60, 200), {
  fixedUpdate: () => {
    const frame = input.sample(0, 0);
    player.x += frame.axisX * 2;
    player.y += frame.axisY * 2;
    camera.follow(player.x, player.y, 0.15);
  },
  render: (alpha) => {
    const view = camera.view(alpha);
    renderer.beginFrame('#141210');
    renderer.pushWorld(view);
    renderer.fillRect(player.x - 12, player.y - 12, 24, 24, '#d8c66a');
    renderer.popWorld();
    renderer.endFrame();
  },
});
loop.start();
