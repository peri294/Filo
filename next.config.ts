import type { NextConfig } from "next";

// Páginas con datos personales o de sesión: que no las guarden caches compartidas, no se filtre
// el link como Referer a otros sitios (el del comprobante es privado) y no se indexen.
const privateHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:slug/turno/:token", headers: privateHeaders },
      { source: "/cuenta/:path*", headers: privateHeaders },
      { source: "/cuenta", headers: privateHeaders },
      { source: "/panel/:path*", headers: privateHeaders },
      { source: "/panel", headers: privateHeaders },
      { source: "/superadmin", headers: privateHeaders },
      { source: "/:path*", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
