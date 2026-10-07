/**
 * iSHARP DBMS 2.0 — Field Operations: Daily Records Constants & Utilities
 * Centralized business constants for aquaculture farm chemicals, probiotics,
 * realistic water color spectra, and local timezone-safe date handlers.
 */

export {
    getLocalDateStr,
    parseLocalDate,
    formatLocalDateDisplay
} from "../../../utils/formatters.js";

// Standard farm chemicals & minerals autocomplete list (from iSHARP Farm Inventory)
export const STANDARD_MINERALS = [
    "CALCIUM CARBONATE",
    "CALCIUM HYDROXIDE (LIME)",
    "DOLOMITE",
    "SODIUM CARBONATE (Na2CO3)",
    "SODIUM BICARBONATE",
    "MAGNESIUM CHLORIDE (MgCl2)",
    "MAGNESIUM SULPHATE (MgSO4)",
    "POTASSIUM CHLORIDE (KCl)",
    "POTASSIUM PERMANGANATE",
    "CALCIUM HYPOCHLORITE 65%",
    "COPPER SULPHATE (CuSO4)",
    "ZEOLITE",
    "AGRICULTURAL LIME"
];

// Standard probiotics & fermentation products list
export const STANDARD_PROBIOTICS = [
    "SUPER MS",
    "EM BOKASHI",
    "FOS 50",
    "RICE BRAN",
    "BACILLUS SUBTILIS",
    "SUPER PS",
    "MOLASSES",
    "YEAST FERMENT",
    "LACTOBACILLUS MIX",
    "RHODOPSEUDOMONAS"
];

// Realistic Aquaculture Pond Water Colour Swatches (True 3D CSS Orbs + Simple Names)
export const WATER_COLOUR_OPTIONS = [
    {
        value: "Light Green",
        label: "Lt Green",
        fullLabel: "Lt Green",
        orbBg: "radial-gradient(circle at 35% 30%, #ecfccb 0%, #a3e635 55%, #65a30d 100%)",
        orbBorder: "#4d7c0f"
    },
    {
        value: "Green",
        label: "Green",
        fullLabel: "Green",
        orbBg: "radial-gradient(circle at 35% 30%, #bbf7d0 0%, #22c55e 55%, #15803d 100%)",
        orbBorder: "#15803d"
    },
    {
        value: "Dark Green",
        label: "Dk Green",
        fullLabel: "Dk Green",
        orbBg: "radial-gradient(circle at 35% 30%, #4ade80 0%, #14532d 60%, #052e16 100%)",
        orbBorder: "#052e16"
    },
    {
        value: "Brownish Green",
        label: "Brn Green",
        fullLabel: "Brn Green",
        orbBg: "radial-gradient(circle at 35% 30%, #bef264 0%, #656d1b 52%, #422006 100%)",
        orbBorder: "#3f3f14"
    },
    {
        value: "Tea",
        aliases: ["Tea / Light Brown", "Tea Brown", "Tea Brn"],
        label: "Tea",
        fullLabel: "Tea",
        orbBg: "radial-gradient(circle at 35% 30%, #fde68a 0%, #d97706 55%, #92400e 100%)",
        orbBorder: "#78350f"
    },
    {
        value: "Brown",
        label: "Brown",
        fullLabel: "Brown",
        orbBg: "radial-gradient(circle at 35% 30%, #d6d3d1 0%, #78716c 55%, #292524 100%)",
        orbBorder: "#1c1917"
    },
    {
        value: "Dark Brown",
        label: "Dk Brown",
        fullLabel: "Dk Brown",
        orbBg: "radial-gradient(circle at 35% 30%, #78716c 0%, #44403c 55%, #1c1917 100%)",
        orbBorder: "#0c0a09"
    },
    {
        value: "Turbid / Muddy",
        aliases: ["Turbid", "Muddy", "Turbid Muddy"],
        label: "Turbid",
        fullLabel: "Turbid / Mud",
        orbBg: "radial-gradient(circle at 35% 30%, #e2e8f0 0%, #94a3b8 55%, #475569 100%)",
        orbBorder: "#334155"
    }
];

/**
 * Resolves water colour metadata from any stored or aliased name
 * @param {string} val
 * @returns {object|null}
 */
export function getWaterColourMeta(val) {
    if (!val) return null;
    const clean = String(val).trim().toLowerCase();
    return WATER_COLOUR_OPTIONS.find(o => {
        if (o.value.toLowerCase() === clean) return true;
        if (o.label.toLowerCase() === clean) return true;
        if (o.aliases && o.aliases.some(a => a.toLowerCase() === clean)) return true;
        return false;
    }) || null;
}
