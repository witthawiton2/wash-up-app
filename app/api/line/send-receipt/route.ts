import { NextRequest, NextResponse } from "next/server";
import { pushImageMessage } from "@/lib/line-api";
import { getBaseUrl } from "@/lib/base-url";

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

    // Short URL — receipt route loads data from DB
    const baseUrl = getBaseUrl();
    const ts = Date.now();
    const imageUrl = edited
      ? `${baseUrl}/api/receipt/${orderId}?edited=1&t=${ts}`
      : `${baseUrl}/api/receipt/${orderId}?t=${ts}`;

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
