// ---------------------------------------------------------------------------
//  Locale segment guard for localized pages
//
//  WHY THIS EXISTS
//  Astro is configured with `output: "server"` and `i18n.routing: "manual"`,
//  so every `[lang]/*` route is server-rendered at request time — nothing under
//  `[lang]/` is prerendered (the build only prerenders `search-index.json`).
//  Two consequences follow, and this helper closes both:
//
//    1. A `[lang]` param is NOT validated by Astro. Without a guard, any
//       unknown first path segment (`/anything`, `/totally-random`) matches
//       `[lang]/index.astro` and renders a duplicate copy of a real page with a
//       200 status — an unbounded soft-404 surface.
//    2. `getStaticPaths` props are NOT injected for a server-rendered route.
//       Pages that derived the locale from `Astro.props.locale` therefore fell
//       back to "en" for every locale, so /ar/about and /ar/faq rendered as
//       English (lang="en" dir="ltr"). `Astro.params.lang` is the value that is
//       always populated — in SSR today, and from getStaticPaths if a page is
//       ever marked `prerender = true`.
// ---------------------------------------------------------------------------

import { LOCALE_LIST, type Locale } from "@/i18n";

/**
 * Validate a `[lang]` URL segment.
 *
 * Returns the locale when it is a supported one, otherwise a plain 404
 * `Response`. Callers MUST forward the response:
 *
 * ```astro
 * const _locale = requireLocale(Astro.params.lang);
 * if (_locale instanceof Response) return _locale;
 * const locale = _locale;
 * ```
 */
export function requireLocale(lang: string | undefined): Locale | Response {
  if (lang && (LOCALE_LIST as readonly string[]).includes(lang)) {
    return lang as Locale;
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
