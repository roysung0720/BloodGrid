import path from "node:path";

import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), "..", ".env") });

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const repositoryBasePath = "/BloodGrid";

const nextConfig = {
  // The local and Render-style development server still use standard Next.js
  // behavior. The Pages workflow produces a static browser-only export.
  ...(isGitHubPagesBuild
    ? {
        assetPrefix: `${repositoryBasePath}/`,
        basePath: repositoryBasePath,
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
