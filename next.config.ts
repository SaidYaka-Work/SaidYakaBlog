import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Note: No basePath needed when using a custom domain
  // If you switch to username.github.io/SaidYakaBlog, add:
  // basePath: '/SaidYakaBlog',
};

export default nextConfig;
