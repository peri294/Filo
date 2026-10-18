import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/brand";

// Imagen que muestran WhatsApp, Instagram, etc. al compartir un link del sitio.
export const alt = "Turnos online para barberías";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const salonName = BRAND_NAME;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0e0e0f",
        color: "#f3f1ec",
        padding: 80,
      }}
    >
      <svg
        width="140"
        height="140"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d6a54b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="6" cy="6" r="3" />
        <path d="M8.12 8.12 12 12" />
        <path d="M20 4 8.12 15.88" />
        <circle cx="6" cy="18" r="3" />
        <path d="M14.8 14.8 20 20" />
      </svg>
      <div
        style={{
          marginTop: 40,
          fontSize: 96,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 4,
          textAlign: "center",
        }}
      >
        {salonName}
      </div>
      <div style={{ marginTop: 24, fontSize: 40, color: "#d6a54b" }}>Reservá tu turno online</div>
    </div>,
    { ...size },
  );
}
