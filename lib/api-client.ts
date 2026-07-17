"use client";

// Thin fetch wrapper that injects the X-Lang header (read from localStorage
// via lib/i18n.ts) so customer-facing API routes can return localized
// error messages. Use on customer pages (/my, /register). Same signature
// as fetch — drop-in replacement.

import { getLang } from "./i18n";

// LIFF access token for the current customer, set once after liff.init() so
// customer API routes can verify identity server-side (see lib/line-auth.ts).
// Kept in-module rather than threaded through every call site.
let lineAccessToken: string | null = null;

export function setLineAccessToken(token: string | null) {
  lineAccessToken = token;
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("X-Lang")) headers.set("X-Lang", getLang());
  if (lineAccessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${lineAccessToken}`);
  }
  return fetch(input, { ...init, headers });
}
