type TelegramMessageOptions = {
  disableWebPagePreview?: boolean;
};

/** Escapes dynamic values before they are placed in Telegram's HTML message mode. */
export function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(message: string, options: TelegramMessageOptions = {}) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("[Telegram] Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID in environment variables");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: options.disableWebPagePreview ?? true },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Telegram] Error sending message:", error);
    }
  } catch (err) {
    console.error("[Telegram] Network error:", err);
  }
}
