import { NextRequest, NextResponse } from "next/server";
import { generatePromptPayQR } from "@/lib/promptpay-qr";

export async function GET(request: NextRequest) {
  try {
    const amount = Number(request.nextUrl.searchParams.get("amount") || "0");
    const account = process.env.PROMPTPAY_ACCOUNT || "";

    if (!account) {
      return NextResponse.json({ error: "PromptPay account not configured" }, { status: 500 });
    }

    const qrDataUri = await generatePromptPayQR(account, amount > 0 ? amount : undefined);

    return NextResponse.json({ qr: qrDataUri, account, name: process.env.PROMPTPAY_NAME || "" });
  } catch (error) {
    console.error("QR generation error:", error);
    return NextResponse.json({ error: "Failed to generate QR" }, { status: 500 });
  }
}
