// next.config.ts
import type { NextConfig } from "next";
import path from "path";

/**
 * Paths are derived from this file's own location rather than hard-coded.
 *
 * They previously pointed at /home/brian/Project/Final_year_project/web, which
 * meant the build only worked on one developer's machine — a fresh clone, a CI
 * runner or a deployment host would all fail to resolve them.
 */
const webRoot = __dirname;

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * Type errors currently do NOT fail the build.
   *
   * `npx tsc --noEmit` reports 0 errors for this workspace, so this flag is not
   * hiding anything today — but it also means a future type error would ship
   * silently. Remove it once you are confident the typecheck stays clean; keep
   * `npx tsc --noEmit` in your pre-deploy checks either way.
   */
  typescript: { ignoreBuildErrors: true },

  experimental: {},

  turbopack: {
    root: webRoot,
    resolveAlias: {
      // Force tailwindcss to resolve from web's own node_modules.
      tailwindcss: path.resolve(webRoot, "node_modules/tailwindcss"),
    },
  },
};

export default nextConfig;
