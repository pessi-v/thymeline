/**
 * SVG element factory utilities
 * Reduces boilerplate when creating SVG elements with attributes
 */

type SvgTagName = keyof SVGElementTagNameMap;

type SvgAttributes = Record<string, string | number | undefined>;

/**
 * Create an SVG element with attributes
 */
export function createSvgElement<K extends SvgTagName>(
  tag: K,
  attrs: SvgAttributes = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  setAttributes(el, attrs);
  return el;
}

/**
 * Set multiple attributes on an SVG element
 * Skips undefined values
 */
export function setAttributes(el: SVGElement, attrs: SvgAttributes): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) {
      el.setAttribute(key, String(value));
    }
  }
}

/**
 * Create a text element with common defaults
 */
export function createTextElement(
  text: string,
  attrs: SvgAttributes & {
    x: number;
    y: number;
  },
): SVGTextElement {
  const el = createSvgElement("text", {
    "font-size": 11,
    fill: "#666",
    ...attrs,
  });
  el.textContent = text;
  return el;
}

/**
 * Create a line element
 */
export function createLineElement(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  attrs: SvgAttributes = {},
): SVGLineElement {
  return createSvgElement("line", {
    x1,
    y1,
    x2,
    y2,
    stroke: "#666",
    "stroke-width": 1,
    ...attrs,
  });
}

/**
 * Create a rect element
 */
export function createRectElement(
  x: number,
  y: number,
  width: number,
  height: number,
  attrs: SvgAttributes = {},
): SVGRectElement {
  return createSvgElement("rect", {
    x,
    y,
    width,
    height,
    ...attrs,
  });
}

/**
 * Create a circle element
 */
export function createCircleElement(
  cx: number,
  cy: number,
  r: number,
  attrs: SvgAttributes = {},
): SVGCircleElement {
  return createSvgElement("circle", {
    cx,
    cy,
    r,
    ...attrs,
  });
}
