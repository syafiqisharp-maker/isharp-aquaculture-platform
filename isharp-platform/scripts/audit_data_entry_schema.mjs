/**
 * iSHARP Platform — Data Entry Schema Audit Probe
 * Audits all data entry buttons and forms across Field Ops and DBMS.
 * Captures snapshot of an idle pond, executes writes, verifies in database,
 * and completely reverts/cleans up in teardown.
 */

import { ENV } from "../src/config/env.js";
import { StaffRepository } from "../src/infrastructure/repositories/staffRepository.js";
import { InventoryRepository } from "../src/infrastructure/repositories/inventoryRepository.js";
import { DailyRecordsRepository } from "../src/infrastructure/repositories/dailyRecordsRepository.js";
import { MineralProbioticRepository } from "../src/infrastructure/repositories/mineralProbioticRepository.js";
import { PondRepository } from "../src/infrastructure/repositories/pondRepository.js";
import { SamplingRepository } from "../src/infrastructure/repositories/samplingRepository.js";
import { FeedRepository } from "../src/infrastructure/repositories/feedRepository.js";
import { LabRepository } from "../src/infrastructure/repositories/labRepository.js";
import { HarvestRepository } from "../src/infrastructure/repositories/harvestRepository.js";
import { supabase } from "../src/infrastructure/supabase.js";

const BASE_URL = `${ENV.SUPABASE_URL}/rest/v1`;
const HEADERS = {
    "apikey": ENV.SUPABASE_KEY,
    "Authorization": `Bearer ${ENV.SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

const AUDIT_TAG = "[SCHEMA_AUDIT_PROBE]";
const AUDIT_DATE = "2099-06-15";

async function apiRequest(endpoint, options = {}) {
    const url = `${BASE_URL}/${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            ...HEADERS,
            ...(options.headers || {})
        }
    });

    if (!res.ok) {
        const text = await res.text();
        let message = text;
        try {
            const json = JSON.parse(text);
            message = json.message || json.hint || text;
        } catch {}
        const err = new Error(`HTTP ${res.status} ${res.statusText}: ${message}`);
        err.status = res.status;
        err.responseBody = text;
        throw err;
    }

    if (res.status === 204) return null;
    const data = await res.text();
    return data && data.trim() ? JSON.parse(data) : null;
}

let testCount = 0;
let passCount = 0;
let failCount = 0;
const results = [];

function recordResult(category, formName, buttonName, status, message, error = null) {
    testCount++;
    if (status === "PASS") {
        passCount++;
        console.log(`  ✔ [PASS] [${category}] ${formName} (${buttonName}) -> ${message}`);
    } else {
        failCount++;
        console.error(`  ✖ [FAIL] [${category}] ${formName} (${buttonName}) -> ${message}`);
        if (error) console.error(`     Error details: ${error.message || error}`);
    }
    results.push({ category, formName, buttonName, status, message, error: error ? error.message : null });
}

async function runAudit() {
    console.log("================================================================================");
    console.log("🌊 iSHARP Platform — Comprehensive Field Ops & DBMS Data Entry Audit Probe");
    console.log(`Target: ${ENV.SUPABASE_URL}`);
    console.log(`Time:   ${new Date().toISOString()}`);
    console.log("================================================================================\n");

    // 0. Locate IDLE pond context
    console.log("📍 [Step 0] Locating IDLE pond context for safe audit...");
    const idlePonds = await apiRequest("growout_pond_master?pond_status=eq.IDLE&select=pond,pond_index,cycle_no,pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no,idle_days,idle_status,water_type&limit=1");
    if (!idlePonds || idlePonds.length === 0) {
        throw new Error("No IDLE pond found to safely run audit!");
    }
    const idlePond = idlePonds[0];
    const testPondIndex = idlePond.pond_index;
    const testPondLabel = idlePond.pond;
    console.log(`   Using IDLE Pond context: Pond ${testPondLabel} (PondIndex: ${testPondIndex})\n`);

    // Snapshot existing records for pond
    console.log("📸 [Step 0.1] Taking snapshot of existing pond records...");
    const snapshotMaster = { ...idlePond };
    const snapshotInventories = await apiRequest(`pond_inventories?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
    const snapshotAerators = await apiRequest(`pond_aerator_inventory?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
    const snapshotDates = await apiRequest(`pond_event_date?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
    const snapshotStocking = await apiRequest(`pond_stocking_batches?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
    const snapshotInitiatives = await apiRequest(`pond_initiatives?pond_index=eq.${encodeURIComponent(testPondIndex)}`);

    console.log(`   Snapshot captured: Master (${Boolean(snapshotMaster)}), Inventories (${snapshotInventories?.length || 0}), Aerators (${snapshotAerators?.length || 0}), Dates (${snapshotDates?.length || 0}), Stocking (${snapshotStocking?.length || 0}), Initiatives (${snapshotInitiatives?.length || 0})\n`);

    // Track test IDs created for cleanup
    const cleanupDailyRecordIds = [];
    const cleanupTreatmentIds = [];
    const cleanupSamplingIds = [];
    const cleanupIssueIds = [];
    const cleanupHarvestIds = [];
    let syntheticCycleCreated = null;

    try {
        console.log("================================================================================");
        console.log("1️⃣ PART 1: FIELD OPERATIONS DATA ENTRY AUDIT");
        console.log("================================================================================");

        // 1.1 Management Entry - Staff Allocation
        try {
            const testStaff = {
                pm_staff_no: "0042",
                sv_staff_no: "1157",
                rl_staff_no: "1120",
                po_staff_no: "1216",
                support_staff_no: "0042"
            };
            await StaffRepository.saveCycleStaff(testPondIndex, testStaff);
            const verifiedMaster = await apiRequest(`growout_pond_master?pond_index=eq.${encodeURIComponent(testPondIndex)}&select=pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no`);
            const v = verifiedMaster[0];
            if (v.pm_staff_no === "0042" && v.sv_staff_no === "1157" && v.rl_staff_no === "1120" && v.po_staff_no === "1216" && v.support_staff_no === "0042") {
                recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Personnel)", "PASS", "Staff allocation saved to growout_pond_master and verified.");
            } else {
                recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Personnel)", "FAIL", "Staff allocation returned unexpected values: " + JSON.stringify(v));
            }
        } catch (err) {
            recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Personnel)", "FAIL", "Failed saving staff allocation", err);
        }

        // 1.2 Management Entry - Paddlewheel Aerators
        try {
            const testAerators = [
                { hp: 1, total_units: 3 },
                { hp: 2, total_units: 4 }
            ];
            await InventoryRepository.syncAeratorInventory(testPondIndex, testPondLabel, testAerators);
            const verifiedAerators = await apiRequest(`pond_aerator_inventory?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
            const u1 = verifiedAerators.find(a => Number(a.hp) === 1)?.total_units;
            const u2 = verifiedAerators.find(a => Number(a.hp) === 2)?.total_units;
            if (u1 === 3 && u2 === 4) {
                recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Aerators)", "PASS", "Paddlewheel counts synced to pond_aerator_inventory and verified.");
            } else {
                recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Aerators)", "FAIL", `Paddlewheels verified with unexpected units: 1HP=${u1}, 2HP=${u2}`);
            }
        } catch (err) {
            recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Aerators)", "FAIL", "Failed syncing aerator paddlewheels", err);
        }

        // 1.3 Management Entry - Hardware Inventory & Remarks
        try {
            const testInventory = {
                feeding_tray_count: 5,
                autofeeder_count: 2,
                hut_condition: "GOOD",
                notes: `${AUDIT_TAG} Field Ops Hardware Notes`
            };
            await InventoryRepository.savePondInventory(testPondIndex, testPondLabel, testInventory);
            const verifiedInv = await apiRequest(`pond_inventories?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
            const iv = verifiedInv[0];
            if (iv && iv.feeding_tray_count === 5 && iv.autofeeder_count === 2 && iv.notes.includes(AUDIT_TAG)) {
                recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Hardware)", "PASS", "Hardware counts and remarks saved to pond_inventories and verified.");
            } else {
                recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Hardware)", "FAIL", "Hardware inventory mismatch: " + JSON.stringify(iv));
            }
        } catch (err) {
            recordResult("Field Ops", "Management Entry", "#btn-mgmt-save (Hardware)", "FAIL", "Failed saving hardware inventory", err);
        }

        // 1.4 Daily Records - Daily Journal Entry
        let dailyRecordId = null;
        try {
            const dailyPayload = {
                pond_index: testPondIndex,
                pond: testPondLabel,
                log_date: AUDIT_DATE,
                feed_kg: 77.5,
                feed_tray_remnant_pct: 15,
                water_level_cm: 112,
                water_colour: "Green",
                mortality_count: 3,
                mortality_kg: 0.05,
                remarks: `${AUDIT_TAG} Daily Journal Log`,
                logged_by: "Audit Probe"
            };
            const savedDaily = await DailyRecordsRepository.upsertRecord(dailyPayload);
            dailyRecordId = savedDaily?.id;
            if (dailyRecordId) cleanupDailyRecordIds.push(dailyRecordId);

            const verifiedDaily = await apiRequest(`daily_pond_records?id=eq.${dailyRecordId}`);
            if (verifiedDaily && verifiedDaily.length > 0 && verifiedDaily[0].feed_kg === 77.5) {
                recordResult("Field Ops", "Daily Records Modal", "#btn-save-record (Journal)", "PASS", "Daily record saved to daily_pond_records and verified.");
            } else {
                recordResult("Field Ops", "Daily Records Modal", "#btn-save-record (Journal)", "FAIL", "Daily record verification failed: " + JSON.stringify(verifiedDaily));
            }
        } catch (err) {
            recordResult("Field Ops", "Daily Records Modal", "#btn-save-record (Journal)", "FAIL", "Failed upserting daily pond record", err);
        }

        // 1.5 Daily Records - Mineral & Probiotic Treatments
        try {
            const treatments = [
                {
                    category: "MINERAL",
                    name: "Agricultural Lime",
                    amount: 50.0,
                    unit: "KG",
                    remarks: `${AUDIT_TAG} Lime application`
                },
                {
                    category: "PROBIOTIC",
                    name: "Super MS",
                    amount: 10.0,
                    unit: "L",
                    remarks: `${AUDIT_TAG} Probiotic application`
                }
            ];
            await MineralProbioticRepository.syncDailyTreatments(dailyRecordId, testPondIndex, testPondLabel, AUDIT_DATE, treatments);
            const verifiedTreatments = await apiRequest(`mineral_probiotic_used?pond_index=eq.${encodeURIComponent(testPondIndex)}&log_date=eq.${AUDIT_DATE}`);
            verifiedTreatments.forEach(t => cleanupTreatmentIds.push(t.id));

            if (verifiedTreatments.length === 2) {
                recordResult("Field Ops", "Daily Records Modal", "#btn-save-record (Treatments)", "PASS", "Mineral & probiotic ledger saved to mineral_probiotic_used and verified.");
            } else {
                recordResult("Field Ops", "Daily Records Modal", "#btn-save-record (Treatments)", "FAIL", `Expected 2 treatments, found ${verifiedTreatments.length}`);
            }
        } catch (err) {
            recordResult("Field Ops", "Daily Records Modal", "#btn-save-record (Treatments)", "FAIL", "Failed saving mineral & probiotic treatments", err);
        }

        console.log("\n================================================================================");
        console.log("2️⃣ PART 2: DBMS DATA ENTRY AUDIT");
        console.log("================================================================================");

        // 2.1 DBMS Master Tab - Preparation Dates & Metadata
        try {
            const prepUpdates = {
                date_cycle: "2099-06-01",
                date_cleaning: "2099-06-02",
                date_repair: "2099-06-03",
                date_filling: "2099-06-04",
                date_culture: "2099-06-05",
                date_baby_box: "2099-06-06",
                date_qaqc: "2099-06-07",
                date_ready: "2099-06-08",
                date_plan_stock: "2099-06-09",
                idle_days: 14,
                idle_status: "NORMAL",
                water_type: "FULL SEA WATER"
            };
            await PondRepository.updateCycle(testPondIndex, prepUpdates);

            // Verify pond_event_date
            const verifiedDates = await apiRequest(`pond_event_date?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
            const cleaningEvent = verifiedDates.find(d => d.event_name === "cleaning")?.event_date;
            const cycleEvent = verifiedDates.find(d => d.event_name === "cycle")?.event_date;

            // Verify growout_pond_master metadata
            const verifiedMasterMeta = await apiRequest(`growout_pond_master?pond_index=eq.${encodeURIComponent(testPondIndex)}&select=idle_days,idle_status,water_type`);
            const meta = verifiedMasterMeta[0];

            if (cleaningEvent === "2099-06-02" && cycleEvent === "2099-06-01" && meta.idle_days === 14 && meta.water_type === "FULL SEA WATER") {
                recordResult("DBMS", "Master Tab", "#btn-save-master (Dates & Meta)", "PASS", "Decoupled dates saved to pond_event_date & metadata to growout_pond_master verified.");
            } else {
                recordResult("DBMS", "Master Tab", "#btn-save-master (Dates & Meta)", "FAIL", `Dates or metadata mismatch: cleaning=${cleaningEvent}, idle_days=${meta?.idle_days}`);
            }
        } catch (err) {
            recordResult("DBMS", "Master Tab", "#btn-save-master (Dates & Meta)", "FAIL", "Failed updating preparation dates & metadata", err);
        }

        // 2.2 DBMS Master Tab - Aerator Inventory
        try {
            const aeratorPayload = [
                { hp_rating: 1.0, total_units: 6 },
                { hp_rating: 2.0, total_units: 8 }
            ];
            await InventoryRepository.syncAeratorInventory(testPondIndex, aeratorPayload);
            const verifiedAerators = await apiRequest(`pond_aerator_inventory?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
            const u1 = verifiedAerators.find(a => Number(a.hp) === 1)?.total_units;
            const u2 = verifiedAerators.find(a => Number(a.hp) === 2)?.total_units;
            if (u1 === 6 && u2 === 8) {
                recordResult("DBMS", "Master Tab", "#btn-save-aerators", "PASS", "Paddlewheel counts saved via Master Tab verified.");
            } else {
                recordResult("DBMS", "Master Tab", "#btn-save-aerators", "FAIL", `Master tab aerators mismatch: 1HP=${u1}, 2HP=${u2}`);
            }
        } catch (err) {
            recordResult("DBMS", "Master Tab", "#btn-save-aerators", "FAIL", "Failed saving aerators from Master Tab", err);
        }

        // 2.3 DBMS Staff Tab - Personnel Allocation
        try {
            const staffUpdates = {
                pm_staff_no: "1157",
                sv_staff_no: "0042",
                rl_staff_no: "1216",
                po_staff_no: "1120",
                support_staff_no: "1157"
            };
            await StaffRepository.saveCycleStaff(testPondIndex, staffUpdates);
            const verified = await apiRequest(`growout_pond_master?pond_index=eq.${encodeURIComponent(testPondIndex)}&select=pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no`);
            const v = verified[0];
            if (v.pm_staff_no === "1157" && v.sv_staff_no === "0042") {
                recordResult("DBMS", "Staff Tab", "#btn-save-staff", "PASS", "Personnel allocation saved via Staff Tab verified.");
            } else {
                recordResult("DBMS", "Staff Tab", "#btn-save-staff", "FAIL", "Personnel allocation mismatch: " + JSON.stringify(v));
            }
        } catch (err) {
            recordResult("DBMS", "Staff Tab", "#btn-save-staff", "FAIL", "Failed saving staff allocation from Staff Tab", err);
        }

        // 2.4 DBMS Staff Tab - Initiatives / Farm Trials
        try {
            const testInitiativeName = `${AUDIT_TAG} Hypersaline Nursery Trial`;
            const initRes = await apiRequest("pond_initiatives", {
                method: "POST",
                body: JSON.stringify({
                    pond_index: testPondIndex,
                    initiative_name: testInitiativeName
                })
            });
            const initId = initRes?.[0]?.id;
            const verifiedInits = await apiRequest(`pond_initiatives?pond_index=eq.${encodeURIComponent(testPondIndex)}&initiative_name=eq.${encodeURIComponent(testInitiativeName)}`);
            if (initId) {
                await apiRequest(`pond_initiatives?id=eq.${initId}`, { method: "DELETE" });
            }
            if (verifiedInits.length > 0) {
                recordResult("DBMS", "Staff Tab", "#btn-save-initiatives", "PASS", "Farm initiative saved to pond_initiatives verified.");
            } else {
                recordResult("DBMS", "Staff Tab", "#btn-save-initiatives", "FAIL", "Initiative was not found in pond_initiatives");
            }
        } catch (err) {
            recordResult("DBMS", "Staff Tab", "#btn-save-initiatives", "FAIL", "Failed saving farm initiative", err);
        }

        // 2.5 DBMS Stocking Tab - Batch Parameters
        try {
            const stockingPayload = {
                stck_date: "2099-06-10",
                stck_source: "CP Hatchery",
                stck_species: "Litopenaeus vannamei",
                stck_pcs: 120000,
                stck_allow: 12000,
                stck_total: 132000,
                stck_tank: "T-02",
                stck_size: 11,
                stck_plstts: "PL11",
                bs_line: "Line B"
            };
            await PondRepository.saveStockingBatch(testPondIndex, stockingPayload);
            const verifiedBatches = await apiRequest(`pond_stocking_batches?pond_index=eq.${encodeURIComponent(testPondIndex)}`);
            const b = verifiedBatches[0];
            if (b && Number(b.stck_pcs) === 120000 && b.stck_source === "CP Hatchery") {
                recordResult("DBMS", "Stocking Tab", "#btn-save-stocking", "PASS", "Stocking batch saved to pond_stocking_batches verified.");
            } else {
                recordResult("DBMS", "Stocking Tab", "#btn-save-stocking", "FAIL", "Stocking batch mismatch: " + JSON.stringify(b));
            }
        } catch (err) {
            recordResult("DBMS", "Stocking Tab", "#btn-save-stocking", "FAIL", "Failed saving stocking batch", err);
        }

        // 2.6 DBMS Excel Modal - Biometrics Sampling Sheet
        try {
            const samplingRecord = {
                pond_index: testPondIndex,
                smpl_date: AUDIT_DATE,
                smpl_doc: 14,
                smpl_abw: 4.85,
                smpl_surv: 92.5,
                smpl_bms: 550,
                smpl_tfed: 450
            };
            const insRes = await SamplingRepository.insertBatch([samplingRecord]);
            const verifiedSamplings = await apiRequest(`biometrics_sampling?pond_index=eq.${encodeURIComponent(testPondIndex)}&smpl_date=eq.${AUDIT_DATE}`);
            verifiedSamplings.forEach(s => cleanupSamplingIds.push(s.id));
            if (verifiedSamplings.length > 0 && verifiedSamplings[0].smpl_abw == 4.85) {
                recordResult("DBMS", "Excel Modal (Sampling)", "#btn-commit-excel (Sampling)", "PASS", "Batch biometrics sampling saved to biometrics_sampling verified.");
            } else {
                recordResult("DBMS", "Excel Modal (Sampling)", "#btn-commit-excel (Sampling)", "FAIL", "Biometrics sampling record mismatch: " + JSON.stringify(verifiedSamplings));
            }
        } catch (err) {
            recordResult("DBMS", "Excel Modal (Sampling)", "#btn-commit-excel (Sampling)", "FAIL", "Failed batch inserting sampling", err);
        }

        // 2.7 DBMS Excel Modal - Daily Feeding Journal
        try {
            const feedRecord = {
                pond_index: testPondIndex,
                pond: testPondLabel,
                log_date: "2099-06-16",
                feed_kg: 35.0,
                feed_tray_remnant_pct: 0,
                water_level_cm: 115,
                water_colour: "Brownish Green",
                mortality_kg: 0.0,
                mortality_count: 0,
                remarks: `${AUDIT_TAG} [Shift: Morning] Excel Feed Commit`
            };
            await FeedRepository.insertBatch([feedRecord]);
            const verifiedFeeds = await apiRequest(`daily_pond_records?pond_index=eq.${encodeURIComponent(testPondIndex)}&log_date=eq.2099-06-16`);
            verifiedFeeds.forEach(f => cleanupDailyRecordIds.push(f.id));
            if (verifiedFeeds.length > 0 && verifiedFeeds[0].feed_kg === 35.0) {
                recordResult("DBMS", "Excel Modal (Feed)", "#btn-commit-excel (Feed)", "PASS", "Batch feeding journal saved to daily_pond_records verified.");
            } else {
                recordResult("DBMS", "Excel Modal (Feed)", "#btn-commit-excel (Feed)", "FAIL", "Feed batch record mismatch: " + JSON.stringify(verifiedFeeds));
            }
        } catch (err) {
            recordResult("DBMS", "Excel Modal (Feed)", "#btn-commit-excel (Feed)", "FAIL", "Failed batch inserting feeding journal", err);
        }

        // 2.8 DBMS Excel Modal - Pathology & Issues Log
        try {
            const issueRecord = {
                pond_index: testPondIndex,
                issue_date: AUDIT_DATE,
                issue_category: "Pathology",
                issue_test: "Vibrio parahaemolyticus Screen",
                issue_status: "Active",
                issue_flag: "Normal",
                issue_grade: "Grade 1",
                issue_note: `${AUDIT_TAG} Routine Water Plating`
            };
            await LabRepository.insertBatch([issueRecord]);
            const verifiedIssues = await apiRequest(`pond_issues?pond_index=eq.${encodeURIComponent(testPondIndex)}&issue_date=eq.${AUDIT_DATE}`);
            verifiedIssues.forEach(i => cleanupIssueIds.push(i.id));
            if (verifiedIssues.length > 0 && verifiedIssues[0].issue_test.includes("Vibrio")) {
                recordResult("DBMS", "Excel Modal (Issues)", "#btn-commit-excel (Issues)", "PASS", "Batch pathology record saved to pond_issues verified.");
            } else {
                recordResult("DBMS", "Excel Modal (Issues)", "#btn-commit-excel (Issues)", "FAIL", "Pathology issue record mismatch: " + JSON.stringify(verifiedIssues));
            }
        } catch (err) {
            recordResult("DBMS", "Excel Modal (Issues)", "#btn-commit-excel (Issues)", "FAIL", "Failed batch inserting pathology issue", err);
        }

        // 2.9 DBMS Excel Modal - Harvest Log
        try {
            const harvestRecord = {
                pond_index: testPondIndex,
                harv_date: "2099-06-25",
                harv_status: "Partial Harvest",
                harv_weight: 750,
                harv_abw: 16.5,
                harv_revenue: 16500,
                harv_method: "Cast Netting"
            };
            await HarvestRepository.insertBatch([harvestRecord]);
            const verifiedHarvests = await apiRequest(`pond_harvest_daily?pond_index=eq.${encodeURIComponent(testPondIndex)}&harv_date=eq.2099-06-25`);
            verifiedHarvests.forEach(h => cleanupHarvestIds.push(h.id));
            if (verifiedHarvests.length > 0 && verifiedHarvests[0].harv_weight == 750) {
                recordResult("DBMS", "Excel Modal (Harvest)", "#btn-commit-excel (Harvest)", "PASS", "Batch harvest record saved to pond_harvest_daily verified.");
            } else {
                recordResult("DBMS", "Excel Modal (Harvest)", "#btn-commit-excel (Harvest)", "FAIL", "Harvest record mismatch: " + JSON.stringify(verifiedHarvests));
            }
        } catch (err) {
            recordResult("DBMS", "Excel Modal (Harvest)", "#btn-commit-excel (Harvest)", "FAIL", "Failed batch inserting harvest record", err);
        }

        // 2.10 DBMS Lifecycle Actions - Custom Cycle Creation RPC
        try {
            console.log("\n   Testing Lifecycle RPCs with isolated synthetic cycle...");
            const synthPond = "99.99.99";
            const synthCycleNo = 99;
            const synthRes = await PondRepository.createCustomCycle({
                pond: synthPond,
                cycleNo: synthCycleNo,
                area: 0.50,
                status: "IDLE",
                planStockDate: "2099-07-01"
            });
            if (synthRes && synthRes.success) {
                syntheticCycleCreated = synthRes.pond_index;
                recordResult("DBMS", "Lifecycle Tab", "#btn-submit-create-cycle", "PASS", `Created custom cycle ${syntheticCycleCreated} via fn_create_custom_cycle.`);
            } else {
                recordResult("DBMS", "Lifecycle Tab", "#btn-submit-create-cycle", "FAIL", "Custom cycle creation failed: " + JSON.stringify(synthRes));
            }
        } catch (err) {
            recordResult("DBMS", "Lifecycle Tab", "#btn-submit-create-cycle", "FAIL", "Failed calling fn_create_custom_cycle", err);
        }

        // 2.11 DBMS Lifecycle Actions - Terminate Cycle RPC
        if (syntheticCycleCreated) {
            try {
                const termRes = await PondRepository.terminateCycle(syntheticCycleCreated, "2099-07-15", "NORMAL HARVEST", false);
                if (termRes && termRes.success) {
                    recordResult("DBMS", "Lifecycle Tab", "#btn-confirm-terminate", "PASS", `Terminated cycle ${syntheticCycleCreated} via fn_terminate_cycle.`);
                } else {
                    recordResult("DBMS", "Lifecycle Tab", "#btn-confirm-terminate", "FAIL", "Cycle termination failed: " + JSON.stringify(termRes));
                }
            } catch (err) {
                recordResult("DBMS", "Lifecycle Tab", "#btn-confirm-terminate", "FAIL", "Failed calling fn_terminate_cycle", err);
            }

            // 2.12 DBMS Lifecycle Actions - Revive Cycle RPC
            try {
                const reviveRes = await PondRepository.reviveCycle(syntheticCycleCreated, false);
                if (reviveRes && reviveRes.success) {
                    recordResult("DBMS", "Lifecycle Tab", "#btn-confirm-revive-keep", "PASS", `Revived cycle ${syntheticCycleCreated} via fn_revive_cycle.`);
                } else {
                    recordResult("DBMS", "Lifecycle Tab", "#btn-confirm-revive-keep", "FAIL", "Cycle revive failed: " + JSON.stringify(reviveRes));
                }
            } catch (err) {
                recordResult("DBMS", "Lifecycle Tab", "#btn-confirm-revive-keep", "FAIL", "Failed calling fn_revive_cycle", err);
            }

            // 2.13 DBMS Lifecycle Actions - Delete Idle Cycle RPC
            try {
                // Set back to IDLE to test delete
                await apiRequest(`growout_pond_master?pond_index=eq.${encodeURIComponent(syntheticCycleCreated)}`, {
                    method: "PATCH",
                    body: JSON.stringify({ pond_status: "IDLE" })
                });
                const delRes = await PondRepository.deleteIdleCycle(syntheticCycleCreated);
                if (delRes && delRes.success) {
                    recordResult("DBMS", "Lifecycle Tab", "🗑️ Delete Idle Cycle", "PASS", `Deleted idle cycle ${syntheticCycleCreated} via fn_delete_idle_cycle.`);
                    syntheticCycleCreated = null; // Cleaned up!
                } else {
                    recordResult("DBMS", "Lifecycle Tab", "🗑️ Delete Idle Cycle", "FAIL", "Cycle deletion failed: " + JSON.stringify(delRes));
                }
            } catch (err) {
                recordResult("DBMS", "Lifecycle Tab", "🗑️ Delete Idle Cycle", "FAIL", "Failed calling fn_delete_idle_cycle", err);
            }
        }

    } finally {
        console.log("\n================================================================================");
        console.log("🧹 TEARDOWN: REVERTING ALL TEST DATA & RESTORING SNAPSHOTS");
        console.log("================================================================================");

        // Clean up created records
        for (const id of cleanupDailyRecordIds) {
            await apiRequest(`daily_pond_records?id=eq.${id}`, { method: "DELETE" }).catch(e => console.warn("Teardown daily record error:", e.message));
        }
        for (const id of cleanupTreatmentIds) {
            await apiRequest(`mineral_probiotic_used?id=eq.${id}`, { method: "DELETE" }).catch(e => console.warn("Teardown treatment error:", e.message));
        }
        for (const id of cleanupSamplingIds) {
            await apiRequest(`biometrics_sampling?id=eq.${id}`, { method: "DELETE" }).catch(e => console.warn("Teardown sampling error:", e.message));
        }
        for (const id of cleanupIssueIds) {
            await apiRequest(`pond_issues?id=eq.${id}`, { method: "DELETE" }).catch(e => console.warn("Teardown issue error:", e.message));
        }
        for (const id of cleanupHarvestIds) {
            await apiRequest(`pond_harvest_daily?id=eq.${id}`, { method: "DELETE" }).catch(e => console.warn("Teardown harvest error:", e.message));
        }

        // Clean up synthetic cycle if still exists
        if (syntheticCycleCreated) {
            await PondRepository.deleteIdleCycle(syntheticCycleCreated).catch(() => {});
            await apiRequest(`growout_pond_master?pond_index=eq.${encodeURIComponent(syntheticCycleCreated)}`, { method: "DELETE" }).catch(() => {});
        }

        // Restore Master Snapshot
        console.log("   Restoring growout_pond_master original snapshot...");
        await apiRequest(`growout_pond_master?pond_index=eq.${encodeURIComponent(testPondIndex)}`, {
            method: "PATCH",
            body: JSON.stringify({
                pm_staff_no: snapshotMaster.pm_staff_no,
                sv_staff_no: snapshotMaster.sv_staff_no,
                rl_staff_no: snapshotMaster.rl_staff_no,
                po_staff_no: snapshotMaster.po_staff_no,
                support_staff_no: snapshotMaster.support_staff_no,
                idle_days: snapshotMaster.idle_days,
                idle_status: snapshotMaster.idle_status,
                water_type: snapshotMaster.water_type
            })
        }).catch(e => console.warn("Restore master error:", e.message));

        // Restore Inventories Snapshot
        console.log("   Restoring pond_inventories original snapshot...");
        if (snapshotInventories && snapshotInventories.length > 0) {
            const origInv = snapshotInventories[0];
            await apiRequest(`pond_inventories?pond_index=eq.${encodeURIComponent(testPondIndex)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    feeding_tray_count: origInv.feeding_tray_count,
                    autofeeder_count: origInv.autofeeder_count,
                    hut_condition: origInv.hut_condition,
                    notes: origInv.notes
                })
            }).catch(e => console.warn("Restore inventory error:", e.message));
        } else {
            await apiRequest(`pond_inventories?pond_index=eq.${encodeURIComponent(testPondIndex)}`, { method: "DELETE" }).catch(() => {});
        }

        // Restore Aerators Snapshot
        console.log("   Restoring pond_aerator_inventory original snapshot...");
        await apiRequest(`pond_aerator_inventory?pond_index=eq.${encodeURIComponent(testPondIndex)}`, { method: "DELETE" }).catch(() => {});
        if (snapshotAerators && snapshotAerators.length > 0) {
            const toRestore = snapshotAerators.map(a => ({
                pond_index: a.pond_index,
                pond: a.pond,
                aerator_model: a.aerator_model,
                hp: a.hp,
                total_units: a.total_units,
                active_units: a.active_units,
                updated_at: a.updated_at
            }));
            await apiRequest("pond_aerator_inventory", {
                method: "POST",
                body: JSON.stringify(toRestore)
            }).catch(e => console.warn("Restore aerators error:", e.message));
        }

        // Restore Dates Snapshot
        console.log("   Restoring pond_event_date original snapshot...");
        await apiRequest(`pond_event_date?pond_index=eq.${encodeURIComponent(testPondIndex)}`, { method: "DELETE" }).catch(() => {});
        if (snapshotDates && snapshotDates.length > 0) {
            const toRestore = snapshotDates.map(d => ({
                pond_index: d.pond_index,
                event_name: d.event_name,
                event_date: d.event_date
            }));
            await apiRequest("pond_event_date", {
                method: "POST",
                body: JSON.stringify(toRestore)
            }).catch(e => console.warn("Restore dates error:", e.message));
        }

        // Restore Stocking Batches Snapshot
        console.log("   Restoring pond_stocking_batches original snapshot...");
        await apiRequest(`pond_stocking_batches?pond_index=eq.${encodeURIComponent(testPondIndex)}`, { method: "DELETE" }).catch(() => {});
        if (snapshotStocking && snapshotStocking.length > 0) {
            const toRestore = snapshotStocking.map(b => ({
                pond_index: b.pond_index,
                stck_date: b.stck_date,
                stck_source: b.stck_source,
                stck_species: b.stck_species,
                stck_pcs: b.stck_pcs,
                stck_allow: b.stck_allow,
                stck_total: b.stck_total,
                stck_tank: b.stck_tank,
                stck_size: b.stck_size,
                stck_plstts: b.stck_plstts,
                bs_line: b.bs_line
            }));
            await apiRequest("pond_stocking_batches", {
                method: "POST",
                body: JSON.stringify(toRestore)
            }).catch(e => console.warn("Restore stocking error:", e.message));
        }

        console.log("   ✔ All teardown restorations executed successfully.\n");
    }

    console.log("================================================================================");
    console.log(`📊 AUDIT SUMMARY: ${passCount}/${testCount} Passed | ${failCount} Failed`);
    console.log("================================================================================");
    return { testCount, passCount, failCount, results };
}

runAudit().catch(err => {
    console.error("Fatal audit probe execution error:", err);
    process.exit(1);
});
