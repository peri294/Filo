import { ImageResponse } from "next/og";

// Ícono para "Agregar a pantalla de inicio" en iPhone: la misma tijera del favicon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0e0e0f",
      }}
    >
      <svg
        width="116"
        height="116"
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
    </div>,
    { ...size },
  );
}
