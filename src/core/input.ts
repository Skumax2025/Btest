/**
 * L0: input abstraction.
 *
 * The simulation only ever sees an `InputFrame` — a plain, serializable value.
 * That is what makes replay and the determinism test possible, and what lets a
 * touch adapter be added later: it just has to produce `InputFrame`s.
 */

export interface InputFrame {
  /** Movement axes in [-1, 1]; already normalized for diagonals. */
  readonly axisX: number;
  readonly axisY: number;
  /** Actions held down this tick. */
  readonly held: readonly string[];
  /** Actions whose press edge landed on this tick. */
  readonly pressed: readonly string[];
  /** Pointer position in world units. */
  readonly pointerX: number;
  readonly pointerY: number;
  readonly pointerDown: boolean;
}

export const EMPTY_INPUT: InputFrame = {
  axisX: 0,
  axisY: 0,
  held: [],
  pressed: [],
  pointerX: 0,
  pointerY: 0,
  pointerDown: false,
};

export const isHeld = (frame: InputFrame, action: string): boolean => frame.held.includes(action);
export const wasPressed = (frame: InputFrame, action: string): boolean =>
  frame.pressed.includes(action);

/** action name -> list of `KeyboardEvent.code` values. Supplied by content (L3). */
export type KeyBindings = Readonly<Record<string, readonly string[]>>;

export interface AxisBindings {
  readonly up: string;
  readonly down: string;
  readonly left: string;
  readonly right: string;
}

/**
 * Collects raw keyboard/mouse state. Remappable: `rebind` replaces the codes for
 * one action without touching anything else.
 */
export class InputDevice {
  private readonly codeToActions = new Map<string, string[]>();
  private readonly heldActions = new Set<string>();
  private readonly pressedActions = new Set<string>();
  private bindings: Record<string, string[]>;
  private pointerScreenX = 0;
  private pointerScreenY = 0;
  private pointerIsDown = false;
  private detachers: Array<() => void> = [];

  constructor(
    bindings: KeyBindings,
    private readonly axes: AxisBindings,
  ) {
    this.bindings = {};
    for (const [action, codes] of Object.entries(bindings)) this.bindings[action] = [...codes];
    this.rebuild();
  }

  rebind(action: string, codes: readonly string[]): void {
    this.bindings[action] = [...codes];
    this.rebuild();
  }

  getBindings(): KeyBindings {
    return this.bindings;
  }

  attach(target: HTMLElement, windowLike: Window): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      const actions = this.codeToActions.get(event.code);
      if (!actions) return;
      event.preventDefault();
      for (const action of actions) {
        if (!this.heldActions.has(action)) this.pressedActions.add(action);
        this.heldActions.add(action);
      }
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      const actions = this.codeToActions.get(event.code);
      if (!actions) return;
      for (const action of actions) this.heldActions.delete(action);
    };
    const onBlur = (): void => {
      this.heldActions.clear();
      this.pointerIsDown = false;
    };
    const onPointerMove = (event: PointerEvent): void => {
      const rect = target.getBoundingClientRect();
      this.pointerScreenX = event.clientX - rect.left;
      this.pointerScreenY = event.clientY - rect.top;
    };
    const onPointerDown = (event: PointerEvent): void => {
      onPointerMove(event);
      this.pointerIsDown = true;
    };
    const onPointerUp = (): void => {
      this.pointerIsDown = false;
    };

    windowLike.addEventListener('keydown', onKeyDown);
    windowLike.addEventListener('keyup', onKeyUp);
    windowLike.addEventListener('blur', onBlur);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerdown', onPointerDown);
    windowLike.addEventListener('pointerup', onPointerUp);

    this.detachers = [
      () => windowLike.removeEventListener('keydown', onKeyDown),
      () => windowLike.removeEventListener('keyup', onKeyUp),
      () => windowLike.removeEventListener('blur', onBlur),
      () => target.removeEventListener('pointermove', onPointerMove),
      () => target.removeEventListener('pointerdown', onPointerDown),
      () => windowLike.removeEventListener('pointerup', onPointerUp),
    ];
  }

  detach(): void {
    for (const detach of this.detachers) detach();
    this.detachers = [];
  }

  get pointerScreen(): { x: number; y: number } {
    return { x: this.pointerScreenX, y: this.pointerScreenY };
  }

  /** Consumes the press edges accumulated since the previous call. */
  sample(pointerWorldX: number, pointerWorldY: number): InputFrame {
    let axisX = 0;
    let axisY = 0;
    if (this.heldActions.has(this.axes.left)) axisX -= 1;
    if (this.heldActions.has(this.axes.right)) axisX += 1;
    if (this.heldActions.has(this.axes.up)) axisY -= 1;
    if (this.heldActions.has(this.axes.down)) axisY += 1;
    if (axisX !== 0 && axisY !== 0) {
      const inverseDiagonal = Math.SQRT1_2;
      axisX *= inverseDiagonal;
      axisY *= inverseDiagonal;
    }
    const frame: InputFrame = {
      axisX,
      axisY,
      held: [...this.heldActions].sort(),
      pressed: [...this.pressedActions].sort(),
      pointerX: pointerWorldX,
      pointerY: pointerWorldY,
      pointerDown: this.pointerIsDown,
    };
    this.pressedActions.clear();
    return frame;
  }

  /** Drops held state — used when the UI grabs focus (inventory, menus). */
  releaseAll(): void {
    this.heldActions.clear();
    this.pressedActions.clear();
  }

  private rebuild(): void {
    this.codeToActions.clear();
    for (const [action, codes] of Object.entries(this.bindings)) {
      for (const code of codes) {
        const list = this.codeToActions.get(code) ?? [];
        list.push(action);
        this.codeToActions.set(code, list);
      }
    }
  }
}
