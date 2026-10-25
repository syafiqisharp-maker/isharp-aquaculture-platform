/**
 * iSHARP Platform — Management Info Compliance Domain Logic
 * 
 * Pure business logic for evaluating whether operational ponds have updated
 * management information for their current cycle:
 * 1. Core Field Crew (Supervisor, Row Leader, Pond Operator present and valid in directory)
 * 2. Active Paddlewheel Aerators (Total HP > 0)
 * 3. Feeding Trays / Autofeeders & Hut Condition
 * 
 * Follows RULES.md Layer 1 Standards: Pure functions only, zero DOM or fetch dependencies.
 */

/**
 * Normalizes staff directory input into a Map or lookup function.
 * @param {Array<object>|Map<string, object>} staffDirectory
 * @returns {Map<string, object>}
 */
export function buildStaffMap(staffDirectory) {
    if (staffDirectory instanceof Map) return staffDirectory;
    const map = new Map();
    if (!Array.isArray(staffDirectory)) return map;

    staffDirectory.forEach(s => {
        if (!s) return;
        const no = String(s.staff_no || "").trim();
        if (no) {
            map.set(no, s);
            const unpadded = String(parseInt(no, 10));
            if (unpadded && !map.has(unpadded)) {
                map.set(unpadded, s);
            }
        }
    });
    return map;
}

/**
 * Validates a staff ID against the staff directory.
 * @param {string|number|null|undefined} staffNo 
 * @param {Map<string, object>} staffMap 
 * @returns {{ isValid: boolean, staff: object|null }}
 */
export function checkStaffValidity(staffNo, staffMap) {
    if (!staffNo) return { isValid: false, staff: null };
    const raw = String(staffNo).trim();
    if (!raw) return { isValid: false, staff: null };

    // Check exact or zero-padded
    const padded = /^\d+$/.test(raw) ? raw.padStart(4, "0") : raw;
    const match = staffMap.get(raw) || staffMap.get(padded);
    return {
        isValid: Boolean(match && match.is_active !== false),
        staff: match || null
    };
}

/**
 * Evaluates management compliance for a single pond cycle.
 * 
 * Rules:
 * - Mandatory Core Crew: Supervisor (sv), Row Leader (rl), and Pond Operator (po)
 *   must be non-empty and resolve to active personnel in staff directory.
 * - Any populated optional staff role (PM, Support) must also be valid in directory.
 * - Aerators: aerator_1hp + aerator_2hp > 0.
 * - Inventory: feeding_tray_count > 0 OR autofeeder_count > 0, and valid hut_condition.
 * 
 * @param {object} pondCycle Record from view_growout_pond_cycles or growout_pond_master
 * @param {object|null} inventoryRecord Record from pond_inventories
 * @param {Array|Map} staffDirectory Master staff directory
 * @returns {object} Compliance evaluation result
 */
export function evaluatePondManagementCompliance(pondCycle = {}, inventoryRecord = null, staffDirectory = []) {
    const staffMap = buildStaffMap(staffDirectory);

    // 1. Evaluate Staff
    const svCheck = checkStaffValidity(pondCycle.sv_staff_no, staffMap);
    const rlCheck = checkStaffValidity(pondCycle.rl_staff_no, staffMap);
    const poCheck = checkStaffValidity(pondCycle.po_staff_no, staffMap);
    const pmCheck = pondCycle.pm_staff_no ? checkStaffValidity(pondCycle.pm_staff_no, staffMap) : null;
    const supCheck = pondCycle.support_staff_no ? checkStaffValidity(pondCycle.support_staff_no, staffMap) : null;

    const invalidStaffIds = [];
    if (pondCycle.sv_staff_no && !svCheck.isValid) invalidStaffIds.push({ role: "SV", id: pondCycle.sv_staff_no });
    if (pondCycle.rl_staff_no && !rlCheck.isValid) invalidStaffIds.push({ role: "RL", id: pondCycle.rl_staff_no });
    if (pondCycle.po_staff_no && !poCheck.isValid) invalidStaffIds.push({ role: "PO", id: pondCycle.po_staff_no });
    if (pondCycle.pm_staff_no && pmCheck && !pmCheck.isValid) invalidStaffIds.push({ role: "PM", id: pondCycle.pm_staff_no });
    if (pondCycle.support_staff_no && supCheck && !supCheck.isValid) invalidStaffIds.push({ role: "Support", id: pondCycle.support_staff_no });

    const hasCoreStaffFilled = Boolean(pondCycle.sv_staff_no && pondCycle.rl_staff_no && pondCycle.po_staff_no);
    const hasValidCoreStaff = Boolean(svCheck.isValid && rlCheck.isValid && poCheck.isValid && invalidStaffIds.length === 0);

    // 2. Evaluate Aerators
    const aerator1 = Number(pondCycle.aerator_1hp || 0);
    const aerator2 = Number(pondCycle.aerator_2hp || 0);
    const totalAeratorUnits = aerator1 + aerator2;
    const totalAeratorHP = (aerator1 * 1.0) + (aerator2 * 2.0);
    const hasValidAerators = totalAeratorHP > 0;

    // 3. Evaluate Pond Hardware & Hut Condition
    const inv = inventoryRecord || (pondCycle.feeding_tray_count !== undefined || pondCycle.hut_condition ? pondCycle : null);
    const trayCount = Number(inv?.feeding_tray_count || 0);
    const feederCount = Number(inv?.autofeeder_count || 0);
    const hutCondition = inv?.hut_condition ? String(inv.hut_condition).trim() : "";
    const hasHutCondition = ["OK", "Need Repair", "Urgent Repair"].includes(hutCondition);
    const hasFeedingEquipment = (trayCount > 0 || feederCount > 0);
    const hasValidInventory = Boolean(inv && hasFeedingEquipment && hasHutCondition);

    // Determine Missing Items
    const missingItems = [];
    if (!hasValidCoreStaff) {
        if (!hasCoreStaffFilled) {
            const missingRoles = [];
            if (!pondCycle.sv_staff_no) missingRoles.push("SV");
            if (!pondCycle.rl_staff_no) missingRoles.push("RL");
            if (!pondCycle.po_staff_no) missingRoles.push("PO");
            missingItems.push(`Core Staff (${missingRoles.join("/")})`);
        } else if (invalidStaffIds.length > 0) {
            const errStr = invalidStaffIds.map(i => `${i.role}=${i.id}`).join(", ");
            missingItems.push(`Invalid Staff ID (${errStr})`);
        }
    }
    if (!hasValidAerators) {
        missingItems.push("Paddlewheels (0 HP)");
    }
    if (!hasValidInventory) {
        if (!inv) {
            missingItems.push("Inventory (Trays/Feeders & Hut)");
        } else {
            const subMissing = [];
            if (!hasFeedingEquipment) subMissing.push("Trays/Feeders");
            if (!hasHutCondition) subMissing.push("Hut Condition");
            missingItems.push(`Inventory (${subMissing.join(", ")})`);
        }
    }

    // Determine Overall Status
    const isCompliant = hasValidCoreStaff && hasValidAerators && hasValidInventory;
    let status = "MISSING";

    const hasAnyData = Boolean(
        pondCycle.sv_staff_no || pondCycle.rl_staff_no || pondCycle.po_staff_no ||
        pondCycle.pm_staff_no || pondCycle.support_staff_no ||
        totalAeratorUnits > 0 ||
        (inv && (trayCount > 0 || feederCount > 0 || hutCondition))
    );

    if (isCompliant) {
        status = "COMPLETE";
    } else if (hasAnyData) {
        status = "PARTIAL";
    } else {
        status = "MISSING";
    }

    return {
        pondIndex: pondCycle.pond_index || "",
        pondLabel: pondCycle.pond || (pondCycle.pond_index ? pondCycle.pond_index.split(".")[0] : ""),
        status, // "COMPLETE" | "PARTIAL" | "MISSING"
        isCompliant,
        hasValidCoreStaff,
        hasValidAerators,
        hasValidInventory,
        missingItems,
        invalidStaffIds,
        staffSummary: {
            sv: svCheck.staff?.staff_name || pondCycle.sv_staff_no || "Unassigned",
            rl: rlCheck.staff?.staff_name || pondCycle.rl_staff_no || "Unassigned",
            po: poCheck.staff?.staff_name || pondCycle.po_staff_no || "Unassigned",
            pm: pmCheck?.staff?.staff_name || pondCycle.pm_staff_no || null,
            support: supCheck?.staff?.staff_name || pondCycle.support_staff_no || null,
            svNo: pondCycle.sv_staff_no || null,
            rlNo: pondCycle.rl_staff_no || null,
            poNo: pondCycle.po_staff_no || null
        },
        aeratorSummary: {
            units1hp: aerator1,
            units2hp: aerator2,
            totalUnits: totalAeratorUnits,
            totalHP: totalAeratorHP
        },
        inventorySummary: {
            feedingTrayCount: trayCount,
            autofeederCount: feederCount,
            hutCondition: hutCondition || "Unspecified",
            notes: inv?.notes || ""
        }
    };
}

/**
 * Aggregates management compliance across all operational ponds grouped by module.
 * 
 * @param {Array<object>} cycles Array of pond cycles
 * @param {Array|Map} inventoryRecords Array or Map of pond_inventories
 * @param {Array|Map} staffDirectory Staff directory
 * @returns {object} Summary object with module breakdowns and farm totals
 */
export function summarizeModuleManagementCompliance(cycles = [], inventoryRecords = [], staffDirectory = []) {
    const invMap = inventoryRecords instanceof Map ? inventoryRecords : new Map();
    if (Array.isArray(inventoryRecords)) {
        inventoryRecords.forEach(inv => {
            if (inv && inv.pond_index) invMap.set(inv.pond_index, inv);
        });
    }

    const staffMap = buildStaffMap(staffDirectory);

    // Filter to active production ponds
    const operationalCycles = (cycles || []).filter(c => {
        const status = String(c.pond_status || "").toUpperCase();
        const active = String(c.pond_active || "").toUpperCase();
        if (c.pond_active !== undefined && c.pond_active !== null && c.pond_active !== "") {
            return status === "PRODUCTION" && active === "ACTIVE";
        }
        return status === "PRODUCTION";
    });

    const modulesMap = new Map();

    operationalCycles.forEach(cycle => {
        const pondIndex = cycle.pond_index || "";
        const pondLabel = cycle.pond || pondIndex;
        // Extract module number (e.g. "04" from modl or "04.07.01" or "2040701.38")
        let modStr = String(cycle.modl || "").padStart(2, "0");
        if ((!modStr || modStr === "00") && pondLabel.includes(".")) {
            modStr = pondLabel.split(".")[0].padStart(2, "0");
        } else if ((!modStr || modStr === "00") && pondIndex.startsWith("2")) {
            modStr = pondIndex.slice(1, 3);
        }
        if (!modStr || modStr === "00") modStr = "Other";

        if (!modulesMap.has(modStr)) {
            modulesMap.set(modStr, {
                module: modStr,
                supervisorName: "",
                totalOperational: 0,
                completedCount: 0,
                partialCount: 0,
                missingCount: 0,
                compliancePercent: 0,
                ponds: []
            });
        }

        const modGroup = modulesMap.get(modStr);
        const invRecord = invMap.get(pondIndex) || null;
        const evaluation = evaluatePondManagementCompliance(cycle, invRecord, staffMap);

        // Infer supervisor name for the module if found
        if (!modGroup.supervisorName && evaluation.staffSummary.sv && evaluation.staffSummary.sv !== "Unassigned") {
            modGroup.supervisorName = evaluation.staffSummary.sv;
        }

        modGroup.totalOperational += 1;
        if (evaluation.status === "COMPLETE") modGroup.completedCount += 1;
        else if (evaluation.status === "PARTIAL") modGroup.partialCount += 1;
        else modGroup.missingCount += 1;

        modGroup.ponds.push({
            cycle,
            evaluation
        });
    });

    // Compute metrics per module
    const modules = Array.from(modulesMap.values()).sort((a, b) => a.module.localeCompare(b.module));
    let farmTotalOperational = 0;
    let farmCompleted = 0;
    let farmPartial = 0;
    let farmMissing = 0;

    modules.forEach(m => {
        m.compliancePercent = m.totalOperational > 0 ? Math.round((m.completedCount / m.totalOperational) * 100) : 0;
        // Sort ponds by pond label
        m.ponds.sort((a, b) => a.evaluation.pondLabel.localeCompare(b.evaluation.pondLabel));
        farmTotalOperational += m.totalOperational;
        farmCompleted += m.completedCount;
        farmPartial += m.partialCount;
        farmMissing += m.missingCount;
    });

    const farmCompliancePercent = farmTotalOperational > 0 ? Math.round((farmCompleted / farmTotalOperational) * 100) : 0;

    return {
        farmTotals: {
            totalOperational: farmTotalOperational,
            completedCount: farmCompleted,
            partialCount: farmPartial,
            missingCount: farmMissing,
            compliancePercent: farmCompliancePercent
        },
        modules
    };
}

/**
 * Formats a WhatsApp callout message summarizing unupdated operational ponds.
 * Can generate either a full farm broadcast (Modules 01–09) or a single module broadcast.
 * 
 * @param {object} summary Output of summarizeModuleManagementCompliance()
 * @param {object} options { filterModule?: string, reportDate?: string }
 * @returns {string} Ready-to-copy WhatsApp formatted message
 */
export function formatWeeklyManagementCalloutWhatsApp(summary, options = {}) {
    const { filterModule = "ALL", reportDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) } = options;

    const farmTotals = summary.farmTotals || { totalOperational: 0, completedCount: 0, partialCount: 0, missingCount: 0, compliancePercent: 0 };
    let targetModules = summary.modules || [];

    if (filterModule && filterModule !== "ALL") {
        targetModules = targetModules.filter(m => m.module === String(filterModule).padStart(2, "0"));
    }

    const lines = [];
    const pendingTotal = farmTotals.totalOperational - farmTotals.completedCount;

    if (filterModule === "ALL") {
        lines.push(`📋 *iSHARP WEEKLY POND MANAGEMENT CALLOUT*`);
        lines.push(`📅 *Date:* ${reportDate}`);
        lines.push(`📊 *Farm Total:* ${farmTotals.completedCount}/${farmTotals.totalOperational} Updated (*${farmTotals.compliancePercent}%*) • ${pendingTotal} Pending`);
        lines.push(``);
        lines.push(`─────────────────────────────`);
    } else {
        const modObj = targetModules[0];
        const modTitle = modObj ? `MODULE ${modObj.module}` : `MODULE ${filterModule}`;
        const svName = modObj?.supervisorName ? ` • SV: ${modObj.supervisorName}` : "";
        const modPending = modObj ? (modObj.totalOperational - modObj.completedCount) : 0;
        lines.push(`📋 *iSHARP MANAGEMENT CALLOUT — ${modTitle}*`);
        lines.push(`📅 *Date:* ${reportDate}`);
        if (modObj) {
            lines.push(`📊 *Status:* ${modObj.completedCount}/${modObj.totalOperational} Updated (*${modObj.compliancePercent}%*) • ${modPending} Pending${svName}`);
        }
        lines.push(``);
    }

    targetModules.forEach(mod => {
        const svTitle = mod.supervisorName ? ` • SV: ${mod.supervisorName}` : "";
        const pendingCount = mod.totalOperational - mod.completedCount;

        if (mod.compliancePercent === 100) {
            lines.push(`📌 *MODULE ${mod.module}* • ${mod.completedCount}/${mod.totalOperational} Updated ✅ (100%)${svTitle}`);
            lines.push(`  • All operational ponds complete`);
        } else {
            lines.push(`📌 *MODULE ${mod.module}* • ${mod.completedCount}/${mod.totalOperational} Updated (${pendingCount} Pending)${svTitle}`);

            // Count missing categories across unupdated ponds in this module
            let missingStaff = 0;
            let missingAerators = 0;
            let missingInventory = 0;

            const unupdatedPonds = mod.ponds.filter(p => p.evaluation.status !== "COMPLETE");
            unupdatedPonds.forEach(p => {
                if (!p.evaluation.hasValidCoreStaff) missingStaff += 1;
                if (!p.evaluation.hasValidAerators) missingAerators += 1;
                if (!p.evaluation.hasValidInventory) missingInventory += 1;
            });

            const missingCategories = [];
            if (missingStaff > 0) missingCategories.push(`Staff (${missingStaff})`);
            if (missingAerators > 0) missingCategories.push(`Aerators (${missingAerators})`);
            if (missingInventory > 0) missingCategories.push(`Inventory (${missingInventory})`);

            const missingSummary = missingCategories.length > 0 ? missingCategories.join(", ") : "Pending verification";
            lines.push(`  • Missing Info: ${missingSummary}`);
        }
        lines.push(``);
    });

    lines.push(`─────────────────────────────`);
    lines.push(`📢 *ACTION REQUIRED FOR FIELD SUPERVISORS:*`);
    lines.push(`Please login to *Field Operations* ➔ Open pond tile ➔ Click *Management Info* to complete:`);
    lines.push(`1. Core Crew (SV, RL, PO) | 2. Paddlewheel Aerators | 3. Feed Trays & Hut`);
    lines.push(``);
    lines.push(`_iSHARP Digital Farm Management Platform_`);

    return lines.join("\n");
}
