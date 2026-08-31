/**
 * L4: entry point. Nothing but wiring, and one guard.
 *
 * A device that cannot give us a 2D canvas — an ancient browser, a hardened
 * one, a webview with canvas disabled — should say so on the page rather than
 * leaving a blank rectangle and an exception in a console nobody has open.
 */

import { Localizer } from '@core/i18n';
import { DEFAULT_LOCALE, LOCALES } from '@content/locales';
import { App } from '@ui/app';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app container is missing from index.html');

try {
  new App(root).start();
} catch (error) {
  // The dictionary is data, so it is available even though the application that
  // normally owns it did not survive construction.
  root.textContent = new Localizer(LOCALES, DEFAULT_LOCALE).t('boot.noCanvas');
  root.className = 'boot-failure';
  throw error;
}
