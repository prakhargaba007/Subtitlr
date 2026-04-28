import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "evbnb.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "crystalpng.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/**",
      },
      {
        protocol: "https",
        hostname: "evbnb.s3.us-east-1.amazonaws.compublic",
      },
    ],
  },
};

export default nextConfig;
