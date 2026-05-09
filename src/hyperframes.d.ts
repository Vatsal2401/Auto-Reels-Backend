// Stub for @hyperframes/core/compiler — subpath exports need node16/bundler
// moduleResolution; this stub satisfies the type checker without changing tsconfig.
declare module '@hyperframes/core/compiler' {
  export function parseHTMLContent(html: string): { body: Element; head: Element; [key: string]: unknown };
  export function injectScriptsIntoHtml(
    html: string,
    headScripts: string[],
    bodyScripts?: string[],
    stripEmbeddedRuntime?: boolean,
  ): string;
  export function compileHTMLContent(...args: unknown[]): unknown;
}
