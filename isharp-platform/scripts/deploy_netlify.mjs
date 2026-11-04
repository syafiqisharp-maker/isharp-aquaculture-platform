/**
 * iSHARP DBMS 2.0 — Production Netlify Deploy Script
 * Builds Vite assets, archives dist/ to a zip buffer, and deploys directly
 * to production on Netlify (https://isharp-platform.netlify.app).
 * 
 * SAFETY GUARD: Requires explicit '--confirm' or '--prod' flag to prevent
 * accidental credit usage.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Safety Check: require explicit confirmation to protect Netlify credits
const hasConfirm = process.argv.includes("--confirm") || process.argv.includes("--prod");
if (!hasConfirm) {
    console.error("\n🛑 Netlify Credit Protection Guard:");
    console.error("   Automatic and accidental deployments are blocked to conserve Netlify credits.");
    console.error("   Make sure the release is thoroughly verified locally with `npm test` and `npm run preview`.");
    console.error("   To deploy to production, run:");
    console.error("     npm run deploy:prod\n");
    process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, "..");
const SITE_ID = "9417a29d-65fc-4676-afe9-87e3b54a7b6a";

// 1. Resolve Netlify Token
let token = process.env.NETLIFY_AUTH_TOKEN;
if (!token) {
    const configPath = path.join(os.homedir(), "AppData", "Roaming", "netlify", "Config", "config.json");
    if (fs.existsSync(configPath)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
            token = cfg.users?.[cfg.userId]?.auth?.token;
        } catch {
            // ignore parse errors
        }
    }
}

if (!token) {
    console.error("❌ Error: No Netlify token found in NETLIFY_AUTH_TOKEN or Netlify CLI config.");
    process.exit(1);
}

// 2. Build Vite
console.log("📦 Building Vite production bundle...");
execSync("npm run build", { cwd: platformRoot, stdio: "inherit" });

// 3. Create zip of dist/ using Python shutil
const distPath = path.join(platformRoot, "dist");
const tempZipBase = path.join(os.tmpdir(), `isharp_deploy_${Date.now()}`);
console.log("🗜️ Archiving dist directory...");
execSync(`python -c "import shutil; shutil.make_archive(r'${tempZipBase}', 'zip', r'${distPath}')"`);

const zipFile = `${tempZipBase}.zip`;
const zipBuffer = fs.readFileSync(zipFile);
console.log(`🚀 Uploading ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB to Netlify (Site ID: ${SITE_ID})...`);

try {
    const normalizedZipPath = zipFile.replace(/\\/g, "/");
    const curlCmd = `curl.exe -s -S -X POST "https://api.netlify.com/api/v1/sites/${SITE_ID}/deploys" ` +
        `-H "Authorization: Bearer ${token}" ` +
        `-H "Content-Type: application/zip" ` +
        `--data-binary @"${normalizedZipPath}" ` +
        `--connect-timeout 60 --max-time 300`;

    const resJsonStr = execSync(curlCmd, { maxBuffer: 15 * 1024 * 1024 }).toString();
    const deploy = JSON.parse(resJsonStr);

    if (!deploy.id) {
        throw new Error(`Netlify deployment failed: ${resJsonStr}`);
    }

    console.log("✅ Production deploy completed successfully!");
    console.log(`   Deploy ID:   ${deploy.id}`);
    console.log(`   Live URL:    ${deploy.ssl_url || deploy.url}`);
    console.log(`   Deploy URL:  ${deploy.deploy_ssl_url || deploy.deploy_url}`);
} finally {
    try {
        if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
    } catch {
        // ignore cleanup error
    }
}
