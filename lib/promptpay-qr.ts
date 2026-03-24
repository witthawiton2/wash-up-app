import QRCode from "qrcode";

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string): string {
  return id + value.length.toString().padStart(2, "0") + value;
}

function generatePromptPayPayload(phoneOrId: string, amount?: number): string {
  // Clean phone number
  let target = phoneOrId.replace(/[^0-9]/g, "");

  // Convert Thai phone to international format
  if (target.length === 10 && target.startsWith("0")) {
    target = "0066" + target.substring(1).padStart(9, "0");
  } else if (target.length === 13) {
    // National ID
    target = target;
  }

  const isPhone = target.startsWith("00");
  const aid = "A000000677010111";
  const merchantInfo =
    tlv("00", aid) +
    tlv(isPhone ? "01" : "02", target);

  let payload =
    tlv("00", "01") + // Format indicator
    tlv("01", amount ? "12" : "11") + // Static or Dynamic QR
    tlv("29", merchantInfo) + // Merchant info
    tlv("53", "764") + // Currency (THB)
    tlv("58", "TH"); // Country

  if (amount && amount > 0) {
    payload += tlv("54", amount.toFixed(2));
  }

  payload += "6304"; // CRC placeholder
  const checksum = crc16(payload);
  payload = payload.slice(0, -4) + "6304" + checksum;

  return payload;
}

export async function generatePromptPayQR(
  phoneOrId: string,
  amount?: number
): Promise<string> {
  const payload = generatePromptPayPayload(phoneOrId, amount);
  const dataUri = await QRCode.toDataURL(payload, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return dataUri;
}
