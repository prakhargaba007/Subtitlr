import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [
      "localhost",
      "127.0.0.1",
      "mcp-laerning-app.s3.eu-north-1.amazonaws.com",
      "api.admin.monsterpokercommunity.com",
      "evbnb.s3.us-east-1.amazonaws.com"
    ],
  },
};

export default nextConfig;
