"use client";

// Thin fetch wrapper that injects the X-Lang header (read from localStorage
// via lib/i18n.ts) so customer-facing API routes can return localized
// error messages. Use on customer pages (/my, /register). Same signature
// as fetch — drop-in replacement.

import { getLang } from "./i18n";

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("X-Lang")) headers.set("X-Lang", getLang());
  return fetch(input, { ...init, headers });
}
