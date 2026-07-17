// Resolves the trusted LINE userId for a customer ("/my", "/renew") request.
//
// The customer portal runs inside LINE LIFF. Historically routes trusted a
// `lineUserId` sent by the client, which lets anyone read another customer's
// data by passing their id (IDOR). This helper instead verifies the caller's
// LIFF access token against LINE and derives the userId from it.
//
// Rollout is gated by LINE_AUTH_ENFORCE so it can ship without risk to the
// live portal:
//   - Whenever a valid Bearer token is present, the *verified* id is used
//     (even with the flag off) — so enabling the client tokens immediately
//     hardens reads without breaking anything.
//   - LINE_AUTH_ENFORCE=1 additionally *rejects* requests with no token or a
//     token that fails verification. Flip this on once tokens are confirmed
//     flowing from the LIFF client.

const LINE_PROFILE_URL = "https://api.line.me/v2/profile";

type Resolved =
  | { userId: string }
  | { error: "line_auth_failed" | "line_auth_unavailable" | "unauthorized" | "missing_line_user"; status: number };

function bearer(request: Request): string {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

export async function resolveLineUser(
  request: Request,
  claimedUserId?: string | null,
): Promise<Resolved> {
  const enforce = process.env.LINE_AUTH_ENFORCE === "1";
  const token = bearer(request);

  if (token) {
    try {
      const res = await fetch(LINE_PROFILE_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = (await res.json()) as { userId?: string };
        if (profile.userId) return { userId: profile.userId };
      }
      // Token present but rejected by LINE.
      if (enforce) return { error: "line_auth_failed", status: 401 };
    } catch {
      // LINE unreachable — fail closed only when enforcing.
      if (enforce) return { error: "line_auth_unavailable", status: 503 };
    }
  } else if (enforce) {
    return { error: "unauthorized", status: 401 };
  }

  // Legacy / dev fallback (flag off, or LINE unreachable): trust the claim.
  if (claimedUserId) return { userId: claimedUserId };
  return { error: "missing_line_user", status: 400 };
}
