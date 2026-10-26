/**
 * iSHARP DBMS 2.0 — Production Netlify Deploy Script
 * Builds Vite assets, archives dist/ to a zip buffer, and deploys directly
 * to production on Netlify (https://isharp-platform.netlify.app).
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
    const res = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/deploys`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/zip"
        },
        body: zipBuffer
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Netlify API returned HTTP ${res.status}: ${errText}`);
    }

    const deploy = await res.json();
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
