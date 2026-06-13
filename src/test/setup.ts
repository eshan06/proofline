import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView; the command palette calls it to keep
// the active item visible. No-op it for tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
