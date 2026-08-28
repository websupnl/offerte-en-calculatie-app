import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Werkplek — WebsUp & Koolhaas Installaties";

export default function OpengraphImage() {
  const iconPath = join(process.cwd(), "public/logos/websup-icon.png");
  const iconBase64 = readFileSync(iconPath).toString("base64");
  const iconSrc = `data:image/png;base64,${iconBase64}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #0b1220 60%, #0f172a 100%)",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={iconSrc} width={120} height={121} alt="" style={{ borderRadius: 28 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#ffffff", letterSpacing: -1 }}>
              Werkplek
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#94a3b8", marginTop: 6 }}>
              WebsUp &amp; Koolhaas Installaties
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 22,
            color: "#cbd5e1",
            padding: "10px 26px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          Offertes, projecten, taken en agenda op één plek
        </div>
      </div>
    ),
    { ...size },
  );
}
