/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    BEDROCK_REGION: process.env.BEDROCK_REGION,
  },
};

export default nextConfig;
