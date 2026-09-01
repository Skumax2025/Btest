/**
 * Input is the only path from a device into the simulation, so it is worth
 * proving without a browser: the same key sequence must always produce the same
 * `InputFrame`, and remapping must actually remap.
 */
import { describe, expect, it } from 'vitest';
import { InputDevice, isHeld, wasPressed } from '@core/input';
import { AXIS_BINDINGS, KEY_BINDINGS } from '@content/tuning';

type Listener = (event: unknown) => void;

/** Minimal stand-ins for the two DOM objects InputDevice touches. */
const fakeTarget = () => {
  const listeners = new Map<string, Listener[]>();
  return {
    listeners,
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((other) => other !== fn));
    },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    fire: (type: string, event: unknown) => {
      for (const fn of listeners.get(type) ?? []) fn(event);
    },
  };
};

const setup = () => {
  const device = new InputDevice(KEY_BINDINGS, AXIS_BINDINGS);
  const target = fakeTarget();
  const win = fakeTarget();
  device.attach(target as unknown as HTMLElement, win as unknown as Window);
  const key = (type: string, code: string): void =>
    win.fire(type, { code, preventDefault: () => undefined });
  return { device, target, win, key };
};

describe('input device', () => {
  it('turns held keys into movement axes', () => {
    const { device, key } = setup();
    key('keydown', 'KeyD');
    expect(device.sample(0, 0).axisX).toBe(1);
    key('keyup', 'KeyD');
    key('keydown', 'KeyW');
    expect(device.sample(0, 0).axisY).toBe(-1);
  });

  it('normalizes diagonals so eight directions are one speed', () => {
    const { device, key } = setup();
    key('keydown', 'KeyD');
    key('keydown', 'KeyS');
    const frame = device.sample(0, 0);
    expect(Math.hypot(frame.axisX, frame.axisY)).toBeCloseTo(1);
  });

  it('reports a press edge exactly once', () => {
    const { device, key } = setup();
    key('keydown', 'Space');
    expect(wasPressed(device.sample(0, 0), 'interact')).toBe(true);
    expect(wasPressed(device.sample(0, 0), 'interact')).toBe(false);
    expect(isHeld(device.sample(0, 0), 'interact')).toBe(true);
  });

  it('remaps an action to a different key', () => {
    const { device, key } = setup();
    device.rebind('interact', ['KeyZ']);
    key('keydown', 'KeyE');
    expect(isHeld(device.sample(0, 0), 'interact')).toBe(false);
    key('keydown', 'KeyZ');
    expect(isHeld(device.sample(0, 0), 'interact')).toBe(true);
  });

  it('drops everything held when focus or the overlay takes over', () => {
    const { device, key } = setup();
    key('keydown', 'KeyD');
    device.releaseAll();
    expect(device.sample(0, 0).axisX).toBe(0);
  });

  it('produces frames that carry no object references', () => {
    const { device, key } = setup();
    key('keydown', 'KeyD');
    const frame = device.sample(12, 34);
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame);
    expect(frame.pointerX).toBe(12);
    expect(frame.pointerY).toBe(34);
  });

  it('binds every action the simulation asks for', () => {
    for (const action of Object.values(AXIS_BINDINGS)) {
      expect(KEY_BINDINGS[action as keyof typeof KEY_BINDINGS]).toBeDefined();
    }
  });
});

/**
 * The second source. A pad has to be indistinguishable from a keyboard by the
 * time the simulation sees it, and it must not be able to do anything a keyboard
 * cannot — including walking faster than one.
 */
describe('a virtual source', () => {
  it('overrides the movement keys while it is pushed, and hands them back', () => {
    const { device, key } = setup();
    key('keydown', 'KeyD');
    expect(device.sample(0, 0).axisX).toBe(1);

    device.setStick(-0.5, 0.25);
    const stick = device.sample(0, 0);
    expect(stick.axisX).toBeCloseTo(-0.5, 6);
    expect(stick.axisY).toBeCloseTo(0.25, 6);

    device.setStick(null, null);
    expect(device.sample(0, 0).axisX).toBe(1);
  });

  it('cannot ask for more speed than a key can', () => {
    const { device } = setup();
    device.setStick(6, 8);
    const frame = device.sample(0, 0);
    expect(Math.hypot(frame.axisX, frame.axisY)).toBeCloseTo(1, 6);
  });

  it('produces the same press edge a key does, once per press', () => {
    const { device } = setup();
    device.setVirtualAction('interact', true);
    expect(wasPressed(device.sample(0, 0), 'interact')).toBe(true);
    // Still held on the next tick, but the edge is spent.
    const second = device.sample(0, 0);
    expect(wasPressed(second, 'interact')).toBe(false);
    expect(isHeld(second, 'interact')).toBe(true);

    device.setVirtualAction('interact', false);
    expect(isHeld(device.sample(0, 0), 'interact')).toBe(false);
  });

  it('merges with the keys rather than replacing them', () => {
    const { device, key } = setup();
    key('keydown', 'KeyE');
    device.setVirtualAction('flashlight', true);
    const frame = device.sample(0, 0);
    expect(isHeld(frame, 'handMain')).toBe(true);
    expect(isHeld(frame, 'flashlight')).toBe(true);
  });

  it('lets go of everything it was holding, and of nothing the keys hold', () => {
    const { device, key } = setup();
    key('keydown', 'KeyW');
    device.setVirtualAction('crouch', true);
    device.setStick(1, 0);
    device.sample(0, 0);

    device.releaseVirtual();
    const frame = device.sample(0, 0);
    expect(isHeld(frame, 'crouch')).toBe(false);
    expect(isHeld(frame, 'up')).toBe(true);
    // The stick is gone, so the keys have the axes again.
    expect(frame.axisY).toBe(-1);
  });
});
