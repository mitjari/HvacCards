import type { CustomCardEntry } from '../types/home-assistant';

/**
 * Defines the custom element and lists it in the dashboard card picker.
 * Guarded against double registration, which happens when the resource is loaded twice (e.g. dev server plus HACS copy).
 */
export function registerCard(tag: string, element: CustomElementConstructor, entry: Omit<CustomCardEntry, 'type'>): void {
  if (!customElements.get(tag)) {
    customElements.define(tag, element);
  }
  window.customCards = window.customCards ?? [];
  if (!window.customCards.some((card) => card.type === tag)) {
    window.customCards.push({ type: tag, preview: true, ...entry });
  }
}

/** Defines a non-card element (shared widget) once. */
export function defineElement(tag: string, element: CustomElementConstructor): void {
  if (!customElements.get(tag)) {
    customElements.define(tag, element);
  }
}
