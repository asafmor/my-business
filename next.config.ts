import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-report.ts reads these font files at runtime via a dynamically-built
  // path (process.cwd() + join), which Next's build-time file tracer can't
  // always resolve statically — spell it out so the serverless bundle for
  // the reports route always includes them.
  outputFileTracingIncludes: {
    "app/(protected)/reports/**/*": ["src/server/reports/fonts/**/*"],
  },
};

export default nextConfig;
