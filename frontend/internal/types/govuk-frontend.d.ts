// govuk-frontend ships no TypeScript declarations. Only the surface we use.
declare module "govuk-frontend" {
  interface InitAllConfig {
    scope?: Element | Document | null;
    onError?: (error: unknown, context: { element?: Element }) => void;
  }
  export function initAll(config?: InitAllConfig): void;
  export function isSupported(scope?: HTMLElement): boolean;
  export const version: string;

  /** All `createAll` needs from a component is the attribute value it looks
   *  for, so the constructor is typed by that and nothing else. */
  interface ComponentClass {
    moduleName: string;
  }
  export function createAll(
    Component: ComponentClass,
    config?: unknown,
    options?: InitAllConfig
  ): unknown[];
  export const CharacterCount: ComponentClass;
}
