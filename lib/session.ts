// HMAC-signed session cookie + URL token helpers. Uses Web Crypto so it
// works in both the Node runtime (route handlers) and the Edge runtime
// (middleware) without a Node-only crypto import.
//
// Set SESSION_SECRET in your env. If missing, a per-process random secret
// is used — sessions then invalidate on every server restart/redeploy.

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

const enc = new TextEncoder();
const dec = new TextDecoder();

function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) {
    cachedSecret = fromEnv;
  } else {
    // Fallback: per-process random. Logged once so it's obvious.
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    cachedSecret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    if (process.env.NODE_ENV === "production") {
      console.warn("[session] SESSION_SECRET not set — using ephemeral key, sessions will invalidate on restart");
    }
  }
  return cachedSecret;
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return cachedKey;
}

function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64uDecode(s: string): Uint8Array {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface SessionPayload {
  u: string; // username
  n: string; // display name
  r: string; // role
  exp: number; // unix ms
}

export const SESSION_COOKIE = "washup_session";
export const SESSION_MAX_AGE_SECS = 60 * 60 * 24 * 30; // 30 days

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = enc.encode(JSON.stringify(payload));
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, body);
  return `${b64uEncode(body)}.${b64uEncode(sig)}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const [bodyB64, sigB64] = token.split(".");
    if (!bodyB64 || !sigB64) return null;
    const body = b64uDecode(bodyB64);
    const sig = b64uDecode(sigB64);
    const key = await getKey();
    const valid = await crypto.subtle.verify("HMAC", key, sig as BufferSource, body as BufferSource);
    if (!valid) return null;
    const payload = JSON.parse(dec.decode(body)) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Generic HMAC for short tokens (e.g., signing receipt URLs)
export async function hmacSign(input: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return b64uEncode(sig).slice(0, 22); // ~132 bits — enough to stop guessing
}

export async function hmacVerify(input: string, sig: string): Promise<boolean> {
  const expected = await hmacSign(input);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
