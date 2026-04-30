/// <reference types="react" />

/**
 * Used by tsconfig.e2e-test.json JSX factory settings:
 * - jsxFactory: renderer.create
 * - jsxFragmentFactory: renderer.fragment
 *
 * Runtime import is injected by Vitest esbuild config (jsxInject), but `tsc --noEmit`
 * also needs this identifier to exist in type scope.
 */
declare const renderer: {
  create: (...args: unknown[]) => unknown;
  fragment: (...args: unknown[]) => unknown;
};

declare namespace HTML {
  interface Attributes {
    children?: React.ReactNode;
  }
}
