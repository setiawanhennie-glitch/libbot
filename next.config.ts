import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [
    { protocol: 'https', hostname: 'covers.openlibrary.org' },
    { protocol: 'https', hostname: 'plidf483gep8s26l.public.blob.vercel-storage.com'},
  ]}
};

export default nextConfig;
