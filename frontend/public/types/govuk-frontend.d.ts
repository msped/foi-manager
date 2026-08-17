// govuk-frontend ships no TypeScript declarations. Only the surface we use.
declare module "govuk-frontend" {
  interface InitAllConfig {
    scope?: Element | Document | null;
    onError?: (error: unknown, context: { element?: Element }) => void;
  }
  export function initAll(config?: InitAllConfig): void;
  export function isSupported(scope?: HTMLElement): boolean;
  export const version: string;
}
