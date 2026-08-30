/**
 * L3: the shape of the guidebook.
 *
 * Which sections exist, in what order, which keys they show, and which numbers
 * they quote. The prose itself is in the locale files; the numbers are read from
 * the tuning tables right here, so the text cannot drift away from the balance.
 */

import type { TextParams } from '@core/i18n';

export interface GuideSection {
  readonly titleKey: string;
  readonly bodyKeys: readonly string[];
  /** Values substituted into this section's paragraphs. */
  readonly params?: () => TextParams;
  /** Actions listed as a control table under the text. */
  readonly controls?: readonly string[];
}

export const GUIDE_SECTIONS: readonly GuideSection[] = [];
