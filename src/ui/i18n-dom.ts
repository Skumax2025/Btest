/**
 * L4: DOM elements that know which string they are showing.
 *
 * Static labels are built once and registered here; switching language calls
 * `refresh()` and every one of them is rewritten in place. Text that changes
 * every frame does not need this — it is re-read from the localizer anyway.
 */

import type { Localizer, TextParams } from '@core/i18n';
import { setText } from './dom';

interface Binding {
  readonly element: HTMLElement;
  readonly key: string;
  readonly params?: () => TextParams;
  /** Written into this attribute instead of the element's text, when given. */
  readonly attribute?: string;
}

export class TextBinder {
  private readonly bindings: Binding[] = [];

  constructor(private readonly localizer: Localizer) {}

  /** Registers an element and writes the current translation into it at once. */
  bind(element: HTMLElement, key: string, params?: () => TextParams): HTMLElement {
    const binding: Binding = { element, key, params };
    this.bindings.push(binding);
    this.apply(binding);
    return element;
  }

  /**
   * The same, into an attribute. A button whose face is a glyph still has to say
   * what it does to a screen reader, and that sentence is translated like any
   * other — it just does not live in the element's text.
   */
  bindAttribute(element: HTMLElement, attribute: string, key: string): HTMLElement {
    const binding: Binding = { element, key, attribute };
    this.bindings.push(binding);
    this.apply(binding);
    return element;
  }

  /** Drops bindings whose element is no longer in the document. */
  refresh(): void {
    for (let i = this.bindings.length - 1; i >= 0; i--) {
      const binding = this.bindings[i];
      if (!binding.element.isConnected) {
        this.bindings.splice(i, 1);
        continue;
      }
      this.apply(binding);
    }
  }

  private apply(binding: Binding): void {
    const text = this.localizer.t(binding.key, binding.params?.());
    if (binding.attribute) binding.element.setAttribute(binding.attribute, text);
    else setText(binding.element, text);
  }
}
