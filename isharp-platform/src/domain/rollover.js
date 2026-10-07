/**
 * iSHARP DBMS 2.0 — Cycle Rollover & Index Rules
 * PURE DOMAIN FUNCTIONS
 */

/**
 * Extracts the base pond number and cycle number from a pond_index (e.g., '2010212.43' -> { base: '2010212', cycle: 43 })
 * @param {string} pondIndex 
 * @returns {{ base: string, cycle: number, nextIndex: string }}
 */
export function parsePondIndex(pondIndex) {
    if (!pondIndex || typeof pondIndex !== "string") {
        return { base: "", cycle: 0, nextIndex: "" };
    }

    const parts = pondIndex.trim().split(".");
    const base = parts[0] || "";
    const cycle = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;
    const nextCycle = cycle + 1;
    const nextIndex = `${base}.${nextCycle}`;

    return { base, cycle, nextIndex };
}

/**
 * Formats physical pond code (e.g. "01.02.12" or "Pond 01.02.12")
 * @param {string} pond 
 * @returns {string}
 */
export function formatPondLabel(pond) {
    if (!pond) return "Unknown Pond";
    return String(pond).trim();
}

/**
 * Validates whether a pond cycle is eligible for termination/rollover.
 * @param {object} pond 
 * @returns {{ eligible: boolean, reason?: string }}
 */
export function validateRolloverEligibility(pond) {
    if (!pond) {
        return { eligible: false, reason: "No pond cycle selected." };
    }
    if (isCycleClosed(pond)) {
        return { eligible: false, reason: "This cycle is already closed. Please select an active cycle to terminate." };
    }
    return { eligible: true };
}

/**
 * Checks if a pond cycle is currently closed / terminated.
 * @param {object} pond 
 * @returns {boolean}
 */
export function isCycleClosed(pond) {
    if (!pond) return false;
    const status = String(pond.status || pond.pond_status || "").toUpperCase();
    const active = String(pond.active || pond.pond_active || "").toUpperCase();
    return status === "CLOSE" || active.includes("IN") || active.includes("INACTIVE");
}

/**
 * Returns formatted label and CSS status-pill class for final harvest status.
 * @param {string} [finalStatus] e.g. "NORMAL HARVEST", "CULLED POND", "FORCED HARVEST", "NO PRODUCTION"
 * @returns {{ label: string, className: string }}
 */
export function formatFinalStatus(finalStatus) {
    const raw = String(finalStatus || "").trim().toUpperCase();
    if (!raw || raw === "NORMAL HARVEST" || raw === "NORMAL") {
        return { label: "Normal Harvest", className: "status-pill status-production" };
    }
    if (raw.includes("CULL")) {
        return { label: "Culled Pond", className: "status-pill status-danger" };
    }
    if (raw.includes("FORCE") || raw.includes("EMERGENCY")) {
        return { label: "Forced Harvest", className: "status-pill status-warning" };
    }
    if (raw.includes("NO PROD") || raw.includes("ZERO")) {
        return { label: "No Production", className: "status-pill status-close" };
    }
    // Capitalize each word for custom statuses
    const formatted = raw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    return { label: formatted, className: "status-pill status-warning" };
}

/**
 * Evaluates disease status by synchronizing master cycle records with laboratory issues.
 * @param {object} [pond] Pond record with disease_status, date_disease
 * @param {Array<object>} [labIssues] Issues from LabRepository
 * @returns {{ label: string, className: string, footText: string, isAlert: boolean }}
 */
export function evaluateBiosecurityStatus(pond, labIssues = []) {
    const issues = Array.isArray(labIssues) ? labIssues : [];
    const masterDisease = pond ? String(pond.disease_status || "").trim() : "";
    const masterDate = pond && pond.date_disease ? String(pond.date_disease).trim() : null;

    // Check Lab issues for RED / CRITICAL / POSITIVE
    const redIssues = issues.filter(r => {
        const flag = (r.issue_flag || "").toUpperCase();
        const note = (r.issue_note || "").toUpperCase();
        return flag === "RED" || flag === "CRITICAL" || note.includes("POSIT");
    });

    if (redIssues.length > 0) {
        const primary = redIssues[0];
        let pathogen = primary.issue_status || primary.issue_test || primary.issue_category || "Pathogen";
        if (["ACTIVE", "CRITICAL", "POSITIVE", "DISEASE", "PATHOLOGY"].includes(pathogen.toUpperCase())) {
            pathogen = primary.issue_test || primary.issue_category || "Pathogen";
        }
        const grade = primary.issue_grade && primary.issue_grade.toUpperCase() !== "G0" ? ` (${primary.issue_grade})` : "";
        const dateStr = primary.issue_date || masterDate || "Recent";

        return {
            label: `⚠️ ${pathogen} Alert${grade}`,
            className: "disease-pill disease-danger",
            footText: `${redIssues.length} active alert(s) · ${dateStr}`,
            isAlert: true
        };
    }

    // Check master cycle disease_status if not 'NO ISSUES' or empty
    const cleanNames = ["NO ISSUES", "NO ISSUE", "NONE", "CLEAN", "NORMAL", "NEGATIVE"];
    if (masterDisease && !cleanNames.includes(masterDisease.toUpperCase())) {
        const labelText = masterDisease.toUpperCase().replace(/\s+/g, " ");
        const dateStr = masterDate ? ` · ${masterDate}` : "";
        
        // Critical diseases
        const isCritical = ["EHP", "EMS", "WSSV", "MORTALITY", "MORTALiTY"].some(d => labelText.includes(d));
        return {
            label: isCritical ? `⚠️ ${labelText} Alert` : `🟡 ${labelText}`,
            className: isCritical ? "disease-pill disease-danger" : "disease-pill disease-warning",
            footText: `Master Register flag${dateStr}`,
            isAlert: isCritical
        };
    }

    // Check Lab issues for YELLOW / Warning
    const yellowIssues = issues.filter(r => (r.issue_flag || "").toUpperCase() === "YELLOW");
    if (yellowIssues.length > 0) {
        const primary = yellowIssues[0];
        const label = primary.issue_status || primary.issue_test || "Caution Flag";
        return {
            label: `🟡 ${label} (Watch)`,
            className: "disease-pill disease-warning",
            footText: `${yellowIssues.length} cautionary log(s) · Monitor closely`,
            isAlert: false
        };
    }

    // Otherwise clean
    return {
        label: "Pathogen Negative",
        className: "disease-pill disease-ok",
        footText: issues.length > 0 ? "Tested · Negative laboratory records" : "Clean biosecurity · 0 active pathogen alerts",
        isAlert: false
    };
}


