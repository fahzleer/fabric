import { JSDOM } from "jsdom";
import { afterEach, beforeEach } from "bun:test";

process.env["LOG_SILENT"] ??= "true";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const { window } = dom;

(globalThis as Record<string, unknown>).window = window;
(globalThis as Record<string, unknown>).document = window.document;
(globalThis as Record<string, unknown>).navigator = window.navigator;
(globalThis as Record<string, unknown>).location = window.location;
(globalThis as Record<string, unknown>).history = window.history;
(globalThis as Record<string, unknown>).Node = window.Node;
(globalThis as Record<string, unknown>).Element = window.Element;
(globalThis as Record<string, unknown>).HTMLElement = window.HTMLElement;
(globalThis as Record<string, unknown>).HTMLInputElement = window.HTMLInputElement;
(globalThis as Record<string, unknown>).HTMLButtonElement = window.HTMLButtonElement;
(globalThis as Record<string, unknown>).HTMLSelectElement = window.HTMLSelectElement;
(globalThis as Record<string, unknown>).HTMLDivElement = window.HTMLDivElement;
(globalThis as Record<string, unknown>).HTMLSpanElement = window.HTMLSpanElement;
(globalThis as Record<string, unknown>).Event = window.Event;
(globalThis as Record<string, unknown>).MouseEvent = window.MouseEvent;
(globalThis as Record<string, unknown>).KeyboardEvent = window.KeyboardEvent;
(globalThis as Record<string, unknown>).CustomEvent = window.CustomEvent;
(globalThis as Record<string, unknown>).MutationObserver = window.MutationObserver;
(globalThis as Record<string, unknown>).ResizeObserver = window.ResizeObserver
  ?? class ResizeObserver { observe() {} unobserve() {} disconnect() {} };
(globalThis as Record<string, unknown>).IntersectionObserver = window.IntersectionObserver
  ?? class IntersectionObserver { observe() {} unobserve() {} disconnect() {} constructor(_cb: unknown, _opts?: unknown) {} };
(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 16);
(globalThis as Record<string, unknown>).cancelAnimationFrame = clearTimeout;
(globalThis as Record<string, unknown>).getComputedStyle = window.getComputedStyle.bind(window);
(globalThis as Record<string, unknown>).matchMedia = () => ({
  matches: false,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

(globalThis as Record<string, unknown>).Text = window.Text;
(globalThis as Record<string, unknown>).Comment = window.Comment;
(globalThis as Record<string, unknown>).DocumentFragment = window.DocumentFragment;
(globalThis as Record<string, unknown>).NodeList = window.NodeList;
(globalThis as Record<string, unknown>).SVGElement = window.SVGElement;
(globalThis as Record<string, unknown>).NodeFilter = window.NodeFilter;
(globalThis as Record<string, unknown>).TreeWalker = window.TreeWalker;
(globalThis as Record<string, unknown>).Range = window.Range;
(globalThis as Record<string, unknown>).Selection = window.Selection;
(globalThis as Record<string, unknown>).DOMParser = window.DOMParser;
(globalThis as Record<string, unknown>).XMLSerializer = window.XMLSerializer;
(globalThis as Record<string, unknown>).HTMLCollection = window.HTMLCollection;
(globalThis as Record<string, unknown>).NamedNodeMap = window.NamedNodeMap;
(globalThis as Record<string, unknown>).Attr = window.Attr;
(globalThis as Record<string, unknown>).CSSStyleDeclaration = (window as unknown as Record<string, unknown>).CSSStyleDeclaration;
(globalThis as Record<string, unknown>).HTMLLabelElement = window.HTMLLabelElement;
(globalThis as Record<string, unknown>).HTMLAnchorElement = window.HTMLAnchorElement;
(globalThis as Record<string, unknown>).HTMLFormElement = window.HTMLFormElement;
(globalThis as Record<string, unknown>).HTMLTextAreaElement = window.HTMLTextAreaElement;
(globalThis as Record<string, unknown>).HTMLTableElement = window.HTMLTableElement;
(globalThis as Record<string, unknown>).HTMLImageElement = window.HTMLImageElement;
(globalThis as Record<string, unknown>).HTMLUListElement = window.HTMLUListElement;
(globalThis as Record<string, unknown>).HTMLOListElement = window.HTMLOListElement;
(globalThis as Record<string, unknown>).HTMLLIElement = window.HTMLLIElement;
(globalThis as Record<string, unknown>).HTMLParagraphElement = window.HTMLParagraphElement;
(globalThis as Record<string, unknown>).HTMLHeadingElement = window.HTMLHeadingElement;

(window.Element.prototype as unknown as Record<string, unknown>).scrollIntoView = () => undefined;

if (!window.PointerEvent) {
  (globalThis as Record<string, unknown>).PointerEvent = window.MouseEvent;
}

if (!globalThis.structuredClone) {
  (globalThis as Record<string, unknown>).structuredClone = <T>(val: T): T => JSON.parse(JSON.stringify(val));
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});
afterEach(() => {
  document.body.innerHTML = "";
});
