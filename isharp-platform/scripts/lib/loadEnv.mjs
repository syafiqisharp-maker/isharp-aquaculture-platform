/**
 * iSHARP Centralized Credential & Environment Loader for Node (.mjs) Scripts.
 * Reads .env.sync from the workspace root with safe fallbacks.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadIsharpEnv() {
    const candidates = [
        path.resolve(__dirname, "../../../.env.sync"),
        path.resolve(__dirname, "../../.env.sync"),
        path.resolve(process.cwd(), ".env.sync")
    ];

    for (const envPath of candidates) {
        if (fs.existsSync(envPath)) {
            try {
                const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
                for (const raw of lines) {
                    const line = raw.trim();
                    if (!line || line.startsWith("#") || !line.includes("=")) continue;
                    const idx = line.indexOf("=");
                    const key = line.slice(0, idx).trim();
                    const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
                    if (key && val && !process.env[key]) {
                        process.env[key] = val;
                    }
                }
            } catch {
                // Ignore read errors and fall back to defaults
            }
            break;
        }
    }

    return {
        SUPABASE_URL: process.env.SUPABASE_URL || "https://keappoukeagyzpoxkrru.supabase.co",
        SUPABASE_KEY: process.env.SUPABASE_KEY || "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s",
        EDITOR_PASSCODE: process.env.ISHARP_EDITOR_PASSCODE || "mantaray",
        MANAGER_PASSCODE: process.env.ISHARP_MANAGER_PASSCODE || "todak",
        VIEWER_PASSCODE: process.env.ISHARP_VIEWER_PASSCODE || "monodon"
    };
}
