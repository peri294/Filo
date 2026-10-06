import type { NextConfig } from "next";

// El comprobante muestra datos del cliente y su link es la llave para cancelar el turno:
// que no lo guarden caches compartidas ni se filtre como Referer a otros sitios.
const privateHeaders = [
  { key: "Cache-Control", value: "private, no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/turno/:token", headers: privateHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
      { source: "/:path*", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
    ];
  },
};

export default nextConfig;
