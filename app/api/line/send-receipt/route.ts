import { NextRequest, NextResponse } from "next/server";
import { pushImageMessage } from "@/lib/line-api";
import { getBaseUrl } from "@/lib/base-url";
import { hmacSign } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, lineUserId, edited } = body;

    if (!orderId || !lineUserId) {
      return NextResponse.json(
        { error: "orderId and lineUserId are required" },
        { status: 400 }
      );
    }

    // Short URL — receipt route loads data from DB. Include an HMAC signature
    // so LINE (and only LINE) can fetch the image; random URLs are rejected.
    const baseUrl = getBaseUrl();
    const ts = Date.now();
    const sig = await hmacSign(`receipt:${orderId}`);
    const editedParam = edited ? "&edited=1" : "";
    const imageUrl = `${baseUrl}/api/receipt/${orderId}?sig=${sig}&t=${ts}${editedParam}`;

    // Send image via LINE Push Message
    const result = await pushImageMessage(lineUserId, imageUrl);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Receipt sent to LINE" });
  } catch (error) {
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
