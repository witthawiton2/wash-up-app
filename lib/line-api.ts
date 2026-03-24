const LINE_API_URL = "https://api.line.me/v2/bot/message/push";

interface LineImageMessage {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
}

interface LineTextMessage {
  type: "text";
  text: string;
}

interface LinePushRequest {
  to: string;
  messages: (LineImageMessage | LineTextMessage)[];
}

export async function pushImageMessage(
  userId: string,
  imageUrl: string,
  previewUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN is not set" };
  }

  const body: LinePushRequest = {
    to: userId,
    messages: [
      {
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: previewUrl || imageUrl,
      },
    ],
  };

  try {
    const response = await fetch(LINE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `LINE API error: ${response.status} ${JSON.stringify(errorData)}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to send LINE message: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function pushTextWithImage(
  userId: string,
  text: string,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN is not set" };
  }

  const body: LinePushRequest = {
    to: userId,
    messages: [
      { type: "text", text },
      {
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      },
    ],
  };

  try {
    const response = await fetch(LINE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `LINE API error: ${response.status} ${JSON.stringify(errorData)}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to send LINE message: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function pushTextWithImages(
  userId: string,
  text: string,
  imageUrls: string[]
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN is not set" };

  // LINE allows max 5 messages per push — 1 text + up to 4 images
  const messages: (LineTextMessage | LineImageMessage)[] = [
    { type: "text", text },
  ];
  for (const url of imageUrls.slice(0, 4)) {
    if (url.startsWith("http")) {
      messages.push({
        type: "image",
        originalContentUrl: url,
        previewImageUrl: url,
      });
    }
  }

  const body: LinePushRequest = { to: userId, messages };

  try {
    const response = await fetch(LINE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: `LINE API error: ${response.status} ${JSON.stringify(errorData)}` };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: `Failed to send LINE message: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function pushTextMessage(
  userId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN is not set" };
  }

  const body: LinePushRequest = {
    to: userId,
    messages: [
      {
        type: "text",
        text,
      },
    ],
  };

  try {
    const response = await fetch(LINE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `LINE API error: ${response.status} ${JSON.stringify(errorData)}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to send LINE message: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
