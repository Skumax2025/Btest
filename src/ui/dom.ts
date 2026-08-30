/** L4: the three DOM helpers the overlay needs. No framework, by design. */

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
};

/** Writes only when the text actually changed, so the browser stays quiet. */
export const setText = (node: HTMLElement, text: string): void => {
  if (node.textContent !== text) node.textContent = text;
};

export const setStyle = (node: HTMLElement, property: string, value: string): void => {
  if (node.style.getPropertyValue(property) !== value) node.style.setProperty(property, value);
};
