/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Block clickjacking — semua frame embed dari domain lain ditolak.
  { key: "X-Frame-Options", value: "DENY" },
  // Cegah MIME-sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Cegah leak Referer ke domain pihak ketiga.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HSTS — wajib aktif saat sudah di HTTPS produksi.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Batasi fitur browser sensitif.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // CSP — izinkan inline (dibutuhkan Next.js), tapi batasi origin.
  // Untuk produksi: gunakan nonce-based script-src.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://api.digiflazz.com https://*.duitku.com https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.duitku.com",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Modular import — drop dead-code di import yg cuma butuh subset.
  // Hasilnya: bundle JS jauh lebih kecil, parse/load page lebih cepat.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    optimizePackageImports: [
      "lucide-react",
      "@iconify/react",
      "date-fns",
      "react-hook-form",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
    ],
  },
  // Compress server response (dev/prod). Sudah default true di Next 14, tapi explicit.
  compress: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
