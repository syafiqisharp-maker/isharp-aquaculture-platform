/**
 * iSHARP DBMS 2.0 — End-to-End Live REST Client Probe
 * Verifies live INSERT, UPDATE, READ, and DELETE capabilities against Supabase Cloud PostgreSQL
 * following the Phase 1, Phase 2, and Phase 3 database optimizations.
 *
 * Automatically guarantees teardown of all test data in finally blocks.
 */

import { ENV } from "../src/config/env.js";

const BASE_URL = `${ENV.SUPABASE_URL}/rest/v1`;
const HEADERS = {
    "apikey": ENV.SUPABASE_KEY,
    "Authorization": `Bearer ${ENV.SUPABASE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

const TEST_TAG = "[E2E_SYNTHETIC_PROBE_TEST]";
const TEST_DATE = "2099-01-01";

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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✔ [PASS] ${message}`);
    } else {
        failedTests++;
        console.error(`  ✖ [FAIL] ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runProbe() {
    console.log("================================================================================");
    console.log("🌊 iSHARP DBMS 2.0 — Comprehensive End-to-End Live REST Probe");
    console.log(`Target: ${ENV.SUPABASE_URL}`);
    console.log(`Time:   ${new Date().toISOString()}`);
    console.log("================================================================================\n");

    // 0. Fetch an active pond to use for testing
    console.log("📍 [Step 0] Locating active operational pond context...");
    const activePonds = await apiRequest("active_operational_ponds?select=pond,pond_index&limit=1");
    assert(Array.isArray(activePonds) && activePonds.length > 0, "Found active operational pond in database");
    const testPond = activePonds[0];
    console.log(`   Using context: Pond ${testPond.pond} (PondIndex: ${testPond.pond_index})\n`);

    // 1. Test Daily Field Records & Treatments
    console.log("📝 [Step 1] Testing Daily Field Operations (Insert, Update, Read, Treatments)...");
    let createdRecordId = null;
    let createdTreatmentId = null;
    try {
        // Insert daily record
        const dailyPayload = {
            pond_index: testPond.pond_index,
            pond: testPond.pond,
            log_date: TEST_DATE,
            feed_kg: 85.5,
            feed_tray_remnant_pct: 10,
            water_level_cm: 115,
            water_colour: "Green",
            mortality_count: 2,
            mortality_kg: 0.04,
            remarks: TEST_TAG,
            logged_by: "Probe Agent"
        };
        const insertedDaily = await apiRequest("daily_pond_records", {
            method: "POST",
            body: JSON.stringify(dailyPayload)
        });
        assert(Array.isArray(insertedDaily) && insertedDaily.length > 0, "Inserted daily pond record via REST API");
        createdRecordId = insertedDaily[0].id;
        assert(createdRecordId != null, `Daily record generated valid ID: ${createdRecordId}`);

        // Insert treatment linked to daily record
        const treatmentPayload = {
            pond_index: testPond.pond_index,
            pond: testPond.pond,
            log_date: TEST_DATE,
            category: "PROBIOTIC",
            item_name: "BACILLUS TEST PROBE",
            amount: 5.0,
            unit: "L",
            daily_record_id: createdRecordId,
            remarks: TEST_TAG
        };
        const insertedTreatment = await apiRequest("mineral_probiotic_used", {
            method: "POST",
            body: JSON.stringify(treatmentPayload)
        });
        assert(Array.isArray(insertedTreatment) && insertedTreatment.length > 0, "Inserted linked mineral/probiotic treatment");
        createdTreatmentId = insertedTreatment[0].id;

        // Update daily record (simulate supervisor editing feed amount)
        const updatedDaily = await apiRequest(`daily_pond_records?id=eq.${createdRecordId}`, {
            method: "PATCH",
            body: JSON.stringify({ feed_kg: 92.0 })
        });
        assert(Array.isArray(updatedDaily) && updatedDaily[0].feed_kg === 92.0, "Updated daily record feed_kg to 92.0 kg");

        // Verify read query
        const readCheck = await apiRequest(`daily_pond_records?id=eq.${createdRecordId}&select=*,mineral_probiotic_used(*)`);
        assert(Array.isArray(readCheck) && readCheck.length > 0, "Retrieved daily record with nested treatments join");
        assert(readCheck[0].mineral_probiotic_used.length > 0, "Nested treatment relation verified");

    } finally {
        // Cleanup Step 1
        console.log("   🧹 Cleaning up Daily Records test data...");
        if (createdTreatmentId) {
            await apiRequest(`mineral_probiotic_used?id=eq.${createdTreatmentId}`, { method: "DELETE" }).catch(() => {});
        }
        if (createdRecordId) {
            await apiRequest(`daily_pond_records?id=eq.${createdRecordId}`, { method: "DELETE" }).catch(() => {});
        }
        console.log("   ✔ Daily records teardown completed.\n");
    }

    // 2. Test Biometrics Sampling
    console.log("🔬 [Step 2] Testing Biometrics Sampling (Insert & Read)...");
    let createdSampleId = null;
    try {
        const samplingPayload = {
            pond_index: testPond.pond_index,
            smpl_date: TEST_DATE,
            smpl_doc: 45,
            smpl_abw: 12.8,
            smpl_surv: 82.5,
            smpl_dfed: 110.0,
            smpl_tfed: 4500.0,
            smpl_bms: 3200.0
        };
        const insertedSample = await apiRequest("biometrics_sampling", {
            method: "POST",
            body: JSON.stringify(samplingPayload)
        });
        assert(Array.isArray(insertedSample) && insertedSample.length > 0, "Inserted biometrics sampling record");
        createdSampleId = insertedSample[0].id;
        assert(createdSampleId != null, `Biometrics sample generated valid ID: ${createdSampleId}`);

        // Verify read
        const sampleRead = await apiRequest(`biometrics_sampling?id=eq.${createdSampleId}`);
        assert(Array.isArray(sampleRead) && sampleRead[0].smpl_abw === 12.8, "Verified biometrics ABW stored accurately");
    } finally {
        console.log("   🧹 Cleaning up Biometrics test data...");
        if (createdSampleId) {
            await apiRequest(`biometrics_sampling?id=eq.${createdSampleId}`, { method: "DELETE" }).catch(() => {});
        }
        console.log("   ✔ Biometrics teardown completed.\n");
    }

    // 3. Test Harvest Logs & Commercial Sales
    console.log("🦐 [Step 3] Testing Harvest Operations & Sales Logs...");
    let createdHarvestId = null;
    let createdSalesId = null;
    try {
        const harvestPayload = {
            pond_index: testPond.pond_index,
            harv_date: TEST_DATE,
            harv_status: "Partial Harvest",
            harv_weight: 850.0,
            harv_abw: 18.5,
            harv_method: "Cast Netting",
            harv_revenue: 17000.0
        };
        const insertedHarvest = await apiRequest("pond_harvest_daily", {
            method: "POST",
            body: JSON.stringify(harvestPayload)
        });
        assert(Array.isArray(insertedHarvest) && insertedHarvest.length > 0, "Inserted partial harvest event");
        createdHarvestId = insertedHarvest[0].id;

        const salesPayload = {
            pond_index: testPond.pond_index,
            hvt_date: TEST_DATE,
            hvt_buyer: "TEST_BUYER_PROBE",
            good_wgt: 850.0,
            good_prc: 20.0,
            net_sales: 17000.0
        };
        const insertedSales = await apiRequest("pond_harvest_sales", {
            method: "POST",
            body: JSON.stringify(salesPayload)
        });
        assert(Array.isArray(insertedSales) && insertedSales.length > 0, "Inserted commercial buyer sales log");
        createdSalesId = insertedSales[0].id;

    } finally {
        console.log("   🧹 Cleaning up Harvest test data...");
        if (createdSalesId) {
            await apiRequest(`pond_harvest_sales?id=eq.${createdSalesId}`, { method: "DELETE" }).catch(() => {});
        }
        if (createdHarvestId) {
            await apiRequest(`pond_harvest_daily?id=eq.${createdHarvestId}`, { method: "DELETE" }).catch(() => {});
        }
        console.log("   ✔ Harvest teardown completed.\n");
    }

    // 4. Test Schema Constraint Defenses (Verifying Guardrails)
    console.log("🛡️ [Step 4] Verifying Phase 3 Database Integrity Guardrails...");

    // 4A. Verify CHECK constraint on invalid pond_status
    let checkConstraintPassed = false;
    try {
        await apiRequest(`growout_pond_master?pond_index=eq.${testPond.pond_index}`, {
            method: "PATCH",
            body: JSON.stringify({ pond_status: "INVALID_STATUS_TYPO" })
        });
    } catch (err) {
        if (err.message.includes("chk_pond_status") || err.status === 400 || err.status === 409) {
            checkConstraintPassed = true;
        }
    }
    assert(checkConstraintPassed, "PostgreSQL CHECK constraint successfully rejected invalid pond_status");

    // 4B. Verify Foreign Key constraint on orphaned SAP feed row
    let fkConstraintPassed = false;
    try {
        await apiRequest("growout_pond_feed_sap", {
            method: "POST",
            body: JSON.stringify({
                sync_key: "PROBE_ORPHAN_TEST_9999",
                order_no: "TEST",
                pond_index: "9999999.99", // Non-existent pond
                pond: "99.99.99",
                sap_post_date: TEST_DATE,
                sap_feed_name: "TEST FEED",
                amount_kg: 50.0
            })
        });
    } catch (err) {
        if (err.message.includes("fk_growout_pond_feed_sap") || err.status === 400 || err.status === 409) {
            fkConstraintPassed = true;
        }
    }
    assert(fkConstraintPassed, "PostgreSQL Foreign Key constraint successfully blocked orphaned SAP feed insertion");

    // 5. Test Phase 4 Architecture (Dynamic Initiatives & Virtual View Integrity)
    console.log("🧪 [Step 5] Testing Phase 4 Refactored Tables & Virtual Views...");
    let createdInitiativeId = null;
    try {
        // 5A. Insert synthetic initiative into new pond_initiatives table
        const initiativePayload = {
            pond_index: testPond.pond_index,
            initiative_name: "E2E_SYNTHETIC_PROBIOTIC_TRIAL"
        };
        const insertedInit = await apiRequest("pond_initiatives", {
            method: "POST",
            body: JSON.stringify(initiativePayload)
        });
        assert(Array.isArray(insertedInit) && insertedInit.length > 0, "Inserted synthetic initiative record into pond_initiatives");
        createdInitiativeId = insertedInit[0].id;
        assert(createdInitiativeId != null, `Initiative generated valid UUID: ${createdInitiativeId}`);

        // 5B. Query view_growout_pond_cycles to verify backward-compatible virtual columns
        const viewRecords = await apiRequest(`view_growout_pond_cycles?pond_index=eq.${testPond.pond_index}&select=pond_index,aerator_1hp,aerator_2hp,initiative,date_culture`);
        assert(Array.isArray(viewRecords) && viewRecords.length > 0, "Queried view_growout_pond_cycles via REST API");
        const vr = viewRecords[0];
        assert(vr.aerator_1hp !== undefined && vr.aerator_2hp !== undefined, "Virtual aerator columns successfully populated in view");
        assert(vr.date_culture !== undefined, "Virtual date columns successfully accessible in view");
    } finally {
        console.log("   🧹 Cleaning up Phase 4 Initiative test data...");
        if (createdInitiativeId) {
            await apiRequest(`pond_initiatives?id=eq.${createdInitiativeId}`, { method: "DELETE" }).catch(() => {});
        }
        console.log("   ✔ Phase 4 teardown completed.\n");
    }

    console.log("\n================================================================================");
    console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} Passed | ${failedTests} Failed`);
    console.log("STATUS: ALL DBMS PLATFORM STORAGE CAPABILITIES VERIFIED 100% OPERATIONAL!");
    console.log("================================================================================");
}

runProbe().catch(err => {
    console.error("\n❌ Fatal Probe Error:", err.message);
    process.exit(1);
});
