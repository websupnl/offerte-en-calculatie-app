// Leest de bestandsnaam uit een Content-Disposition header van een fetch-response.
export function filenameFromResponse(res: Response, fallback: string): string {
  const header = res.headers.get("content-disposition") ?? "";
  const match = header.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return fallback;
}
