import test from "node:test";
import assert from "node:assert/strict";
import {
    buildStaffMap,
    checkStaffValidity,
    evaluatePondManagementCompliance,
    summarizeModuleManagementCompliance,
    formatWeeklyManagementCalloutWhatsApp
} from "../src/domain/managementCompliance.js";

const mockStaffDirectory = [
    { staff_no: "0042", staff_name: "Bujang Slamat", staff_position: "Deputy Farm Manager", is_active: true },
    { staff_no: "0415", staff_name: "Rosidi Bin Tawang", staff_position: "Head of Row", is_active: true },
    { staff_no: "0937", staff_name: "Muhd Ranzi Bin Abdullah Dawawi", staff_position: "Farm Supervisor", is_active: true },
    { staff_no: "1157", staff_name: "Azlan Bin Che Rus", staff_position: "Farm Supervisor", is_active: true },
    { staff_no: "1120", staff_name: "Mohd Shukri Bin Mat", staff_position: "Head of Row", is_active: true },
    { staff_no: "1216", staff_name: "Ahmad Zaini", staff_position: "Farm Operator", is_active: true },
    { staff_no: "2057", staff_name: "Mohd Faiz", staff_position: "Support Operator", is_active: true },
    { staff_no: "9999", staff_name: "Resigned Staff", staff_position: "Former Operator", is_active: false }
];

test("Staff Map and Validity: correctly resolves padded, unpadded, and rejects inactive/unknown IDs", () => {
    const staffMap = buildStaffMap(mockStaffDirectory);
    assert.equal(staffMap.size >= 8, true);

    // Exact 4-digit
    const res1 = checkStaffValidity("0415", staffMap);
    assert.equal(res1.isValid, true);
    assert.equal(res1.staff?.staff_name, "Rosidi Bin Tawang");

    // Unpadded numeric string
    const res2 = checkStaffValidity("415", staffMap);
    assert.equal(res2.isValid, true);
    assert.equal(res2.staff?.staff_name, "Rosidi Bin Tawang");

    // Inactive staff
    const resInactive = checkStaffValidity("9999", staffMap);
    assert.equal(resInactive.isValid, false);

    // Unknown ID
    const resUnknown = checkStaffValidity("0400", staffMap);
    assert.equal(resUnknown.isValid, false);
    assert.equal(resUnknown.staff, null);
});

test("evaluatePondManagementCompliance: Complete pond when Core Crew is present even if Asst Manager is blank", () => {
    const pondCycle = {
        pond_index: "2040701.38",
        pond: "04.07.01",
        pm_staff_no: null, // Asst Manager blank
        sv_staff_no: "1157",
        rl_staff_no: "1120",
        po_staff_no: "1216",
        support_staff_no: null,
        aerator_1hp: 4,
        aerator_2hp: 2
    };

    const inventory = {
        pond_index: "2040701.38",
        feeding_tray_count: 4,
        autofeeder_count: 2,
        hut_condition: "OK"
    };

    const res = evaluatePondManagementCompliance(pondCycle, inventory, mockStaffDirectory);
    assert.equal(res.status, "COMPLETE");
    assert.equal(res.isCompliant, true);
    assert.equal(res.hasValidCoreStaff, true);
    assert.equal(res.hasValidAerators, true);
    assert.equal(res.hasValidInventory, true);
    assert.equal(res.missingItems.length, 0);
    assert.equal(res.aeratorSummary.totalHP, 8);
});

test("evaluatePondManagementCompliance: Flags invalid/deleted staff IDs (e.g. 0400)", () => {
    const pondCycle = {
        pond_index: "2010102.40",
        pond: "01.01.02",
        sv_staff_no: "1157",
        rl_staff_no: "0400", // Deleted / unrecognized ID
        po_staff_no: "1216",
        aerator_1hp: 4,
        aerator_2hp: 4
    };

    const inventory = {
        feeding_tray_count: 4,
        autofeeder_count: 0,
        hut_condition: "OK"
    };

    const res = evaluatePondManagementCompliance(pondCycle, inventory, mockStaffDirectory);
    assert.equal(res.status, "PARTIAL");
    assert.equal(res.isCompliant, false);
    assert.equal(res.hasValidCoreStaff, false);
    assert.equal(res.invalidStaffIds.length, 1);
    assert.equal(res.invalidStaffIds[0].role, "RL");
    assert.equal(res.invalidStaffIds[0].id, "0400");
    assert.ok(res.missingItems.some(item => item.includes("Invalid Staff ID")));
});

test("evaluatePondManagementCompliance: Partial status when aerators are 0 HP or inventory missing", () => {
    const pondCycle = {
        pond_index: "2030501.41",
        pond: "03.05.01",
        sv_staff_no: "0937",
        rl_staff_no: "0415",
        po_staff_no: "1216",
        aerator_1hp: 0,
        aerator_2hp: 0
    };

    // Inventory has hut condition but 0 trays/feeders
    const inventory = {
        feeding_tray_count: 0,
        autofeeder_count: 0,
        hut_condition: "Need Repair"
    };

    const res = evaluatePondManagementCompliance(pondCycle, inventory, mockStaffDirectory);
    assert.equal(res.status, "PARTIAL");
    assert.equal(res.hasValidCoreStaff, true);
    assert.equal(res.hasValidAerators, false);
    assert.equal(res.hasValidInventory, false);
    assert.ok(res.missingItems.includes("Paddlewheels (0 HP)"));
    assert.ok(res.missingItems.some(i => i.includes("Trays/Feeders")));
});

test("evaluatePondManagementCompliance: Missing status when pond has no staff, 0 HP, and no inventory", () => {
    const pondCycle = {
        pond_index: "2020401.42",
        pond: "02.04.01",
        sv_staff_no: null,
        rl_staff_no: null,
        po_staff_no: null,
        aerator_1hp: 0,
        aerator_2hp: 0
    };

    const res = evaluatePondManagementCompliance(pondCycle, null, mockStaffDirectory);
    assert.equal(res.status, "MISSING");
    assert.equal(res.isCompliant, false);
    assert.ok(res.missingItems.length >= 3);
});

test("summarizeModuleManagementCompliance: aggregates operational ponds and filters out idle ponds", () => {
    const cycles = [
        { pond_index: "2010101.40", pond: "01.01.01", modl: "1", pond_status: "PRODUCTION", sv_staff_no: "1157", rl_staff_no: "1120", po_staff_no: "1216", aerator_1hp: 4, aerator_2hp: 2, feeding_tray_count: 4, hut_condition: "OK" },
        { pond_index: "2010102.40", pond: "01.01.02", modl: "1", pond_status: "PRODUCTION", sv_staff_no: "1157", rl_staff_no: "0400", po_staff_no: "1216", aerator_1hp: 4, aerator_2hp: 2, feeding_tray_count: 4, hut_condition: "OK" },
        { pond_index: "2010103.43", pond: "01.01.03", modl: "1", pond_status: "IDLE", pond_active: "INACTIVE" }, // Should be excluded
        { pond_index: "2081501.31", pond: "08.15.01", modl: "8", pond_status: "PRODUCTION", sv_staff_no: "0937", rl_staff_no: "0415", po_staff_no: "1216", aerator_1hp: 4, aerator_2hp: 4, feeding_tray_count: 4, hut_condition: "OK" }
    ];

    const summary = summarizeModuleManagementCompliance(cycles, [], mockStaffDirectory);
    assert.equal(summary.farmTotals.totalOperational, 3, "Only 3 production ponds should be evaluated");
    assert.equal(summary.farmTotals.completedCount, 2);
    assert.equal(summary.farmTotals.partialCount, 1);
    assert.equal(summary.farmTotals.compliancePercent, 67);

    assert.equal(summary.modules.length, 2);
    const mod1 = summary.modules.find(m => m.module === "01");
    assert.equal(mod1?.totalOperational, 2);
    assert.equal(mod1?.completedCount, 1);
    assert.equal(mod1?.partialCount, 1);
});

test("formatWeeklyManagementCalloutWhatsApp: outputs formatted broadcast text", () => {
    const cycles = [
        { pond_index: "2010101.40", pond: "01.01.01", modl: "1", pond_status: "PRODUCTION", sv_staff_no: "1157", rl_staff_no: "1120", po_staff_no: "1216", aerator_1hp: 4, aerator_2hp: 2, feeding_tray_count: 4, hut_condition: "OK" },
        { pond_index: "2010102.40", pond: "01.01.02", modl: "1", pond_status: "PRODUCTION", sv_staff_no: "1157", rl_staff_no: "0400", po_staff_no: "1216", aerator_1hp: 4, aerator_2hp: 2, feeding_tray_count: 4, hut_condition: "OK" }
    ];
    const summary = summarizeModuleManagementCompliance(cycles, [], mockStaffDirectory);

    const waText = formatWeeklyManagementCalloutWhatsApp(summary, { filterModule: "ALL", reportDate: "25 Oct 2026" });
    assert.ok(waText.includes("iSHARP WEEKLY POND MANAGEMENT CALLOUT"));
    assert.ok(waText.includes("1/2 Updated"));
    assert.ok(waText.includes("Missing Info: Staff (1)"));

    const waMod1 = formatWeeklyManagementCalloutWhatsApp(summary, { filterModule: "01", reportDate: "25 Oct 2026" });
    assert.ok(waMod1.includes("iSHARP MANAGEMENT CALLOUT — MODULE 01"));
    assert.ok(waMod1.includes("1/2 Updated"));
});
test("Weekly Management Callout & Audit Guard: Unconfirmed new cycle is strictly MISSING even if prior cycle had staff (Smart Carry-Forward isolation)", () => {
    // Scenario: Pond 01.01.01 has rolled over to cycle 41.
    // In database (view_growout_pond_cycles), the new cycle record has unconfirmed/null staff and 0 HP aerator.
    // Client-side UI shows Smart Carry-Forward from cycle 40, but database remains untouched until explicit save.
    const unconfirmedNewCycle = {
        pond_index: "2010101.41",
        pond: "01.01.01",
        modl: "1",
        pond_status: "PRODUCTION",
        cycle_no: "41",
        pm_staff_no: null,
        sv_staff_no: null,
        rl_staff_no: null,
        po_staff_no: null,
        support_staff_no: null,
        aerator_1hp: 0,
        aerator_2hp: 0
    };

    const res = evaluatePondManagementCompliance(unconfirmedNewCycle, null, mockStaffDirectory);
    
    // Must be strictly marked MISSING and NON-COMPLIANT
    assert.equal(res.status, "MISSING", "Unconfirmed cycle must be MISSING in weekly compliance report");
    assert.equal(res.isCompliant, false, "Must not be marked compliant before user submits form");
    assert.equal(res.hasValidCoreStaff, false, "Core staff must be flagged invalid/absent");
    assert.ok(res.missingItems.some(i => i.includes("Supervisor") || i.includes("Staff")));
    assert.ok(res.missingItems.includes("Paddlewheels (0 HP)"));
    assert.ok(res.missingItems.includes("Inventory (Trays/Feeders & Hut)"));

    // Verify WhatsApp callout summary lists it as incomplete
    const summary = summarizeModuleManagementCompliance([unconfirmedNewCycle], [], mockStaffDirectory);
    assert.equal(summary.farmTotals.totalOperational, 1);
    assert.equal(summary.farmTotals.completedCount, 0);
    assert.equal(summary.farmTotals.missingCount, 1);
    assert.equal(summary.farmTotals.compliancePercent, 0);

    const wa = formatWeeklyManagementCalloutWhatsApp(summary, { reportDate: "25 Oct 2026" });
    assert.ok(wa.includes("0/1 Updated"));
    assert.ok(wa.includes("1 Pending"));
    assert.ok(wa.includes("Missing Info: Staff (1), Aerators (1), Inventory (1)"));
});
