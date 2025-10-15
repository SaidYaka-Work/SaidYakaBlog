import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/SaidYakaBlog',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
