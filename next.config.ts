import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images :{
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
      },
      {
        protocol: "https",
        hostname: "cloud.appwrite.io",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ]
  }
};

export default nextConfig;
