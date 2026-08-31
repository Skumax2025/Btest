/**
 * L4: item icons in the DOM.
 *
 * The bag, the belt and the hands are HTML, and the catalogue's art is a canvas
 * the sprite store paints once. This turns one into the other: a sprite becomes
 * a data URL the first time it is asked for, and after that it is a string a
 * `background-image` can hold. Nothing here decides what anything looks like —
 * the specs in `@content/sprites` do — and no cell owns a canvas of its own, so
 * dragging a stack around the bag costs nothing.
 */

import type { SpriteProvider } from '@core/assets';
import { setStyle } from './dom';

export class IconSource {
  private readonly urls = new Map<string, string>();

  constructor(private readonly sprites: SpriteProvider) {}

  /** The sprite as a data URL, built on first use and kept. */
  url(id: string): string {
    const cached = this.urls.get(id);
    if (cached !== undefined) return cached;
    const sprite = this.sprites.sprite(id);
    let url = '';
    const source = sprite.source;
    if (source instanceof HTMLCanvasElement) {
      url = source.toDataURL();
    } else {
      // Any other image source is copied through a canvas of its own size.
      const canvas = document.createElement('canvas');
      canvas.width = sprite.width;
      canvas.height = sprite.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(source, sprite.sx, sprite.sy, sprite.width, sprite.height, 0, 0, sprite.width, sprite.height);
        url = canvas.toDataURL();
      }
    }
    this.urls.set(id, url);
    return url;
  }

  /** Puts an icon on a node, or takes it off again when there is nothing to show. */
  paint(node: HTMLElement, spriteId: string | null): void {
    if (!spriteId) {
      setStyle(node, 'background-image', 'none');
      node.hidden = true;
      return;
    }
    node.hidden = false;
    setStyle(node, 'background-image', `url(${this.url(spriteId)})`);
  }
}
