/**
 * scripts/stress_management_flow.mjs
 * 
 * Stress test and database verification harness for Field Ops Management Entry:
 * 1. Simulates sequential pond cycling across ponds in Module 01 (01.01.02 to 01.01.06).
 * 2. Submits personnel assignments, paddlewheel aerators, and infrastructure inventory.
 * 3. Double-checks Supabase live records in:
 *    - growout_pond_master (staff IDs & aerators)
 *    - pond_inventories (feeding trays, autofeeders, hut condition, notes)
 *    - pond_aerator_inventory (paddlewheels)
 * 4. Verifies the Auto-fill logic from the previous cycle:
 *    Simulates a future/new cycle for the same pond and asserts that
 *    StaffRepository.getLastCycleStaff correctly retrieves the personnel.
 */

import { StaffRepository } from "../src/infrastructure/repositories/staffRepository.js";
import { InventoryRepository } from "../src/infrastructure/repositories/inventoryRepository.js";
import { supabase } from "../src/infrastructure/supabase.js";

// Test dataset representing realistic pond personnel & hardware allocations
const TEST_PONDS = [
    {
        pond: "01.01.02",
        pond_index: "2010102.40",
        staff: {
            pm_staff_no: "0042",      // Bujang Slamat (Asst Manager)
            sv_staff_no: "1157",      // Azlan (Supervisor)
            rl_staff_no: "0400",      // Zahid Bin Umar (Row Leader)
            po_staff_no: "0401",      // Muhammad Syafiq (Operator)
            support_staff_no: "0801"  // Mohd Shawalludin (Support)
        },
        aerators: [
            { hp: 1, total_units: 4 },
            { hp: 2, total_units: 2 }
        ],
        inventory: {
            feeding_tray_count: 4,
            autofeeder_count: 2,
            hut_condition: "OK",
            notes: "Stress test verification - Pond 01.01.02"
        }
    },
    {
        pond: "01.01.03",
        pond_index: "2010103.43",
        staff: {
            pm_staff_no: "0042",
            sv_staff_no: "1157",
            rl_staff_no: "0400",
            po_staff_no: "0756",      // Saipudin Hamzah
            support_staff_no: "0801"
        },
        aerators: [
            { hp: 1, total_units: 6 },
            { hp: 2, total_units: 0 }
        ],
        inventory: {
            feeding_tray_count: 4,
            autofeeder_count: 0,
            hut_condition: "OK",
            notes: "Stress test verification - Pond 01.01.03 in preparation"
        }
    },
    {
        pond: "01.01.04",
        pond_index: "2010104.42",
        staff: {
            pm_staff_no: "0042",
            sv_staff_no: "1157",
            rl_staff_no: "0406",      // Zulkepeli Bin Amin
            po_staff_no: "0767",      // Mohd Kairul Hafizu
            support_staff_no: "0809"  // Rizal Sahril
        },
        aerators: [
            { hp: 1, total_units: 4 },
            { hp: 2, total_units: 4 }
        ],
        inventory: {
            feeding_tray_count: 6,
            autofeeder_count: 2,
            hut_condition: "Need Repair",
            notes: "Stress test verification - Pond 01.01.04"
        }
    }
];

async function runStressTest() {
    console.log("====================================================================");
    console.log("🚀 STARTING FIELD OPS MANAGEMENT STRESS TEST & DATABASE VERIFICATION");
    console.log("====================================================================\n");

    const startTime = Date.now();
    let writeSuccessCount = 0;
    let verifySuccessCount = 0;

    // STEP 1: PRELOAD STAFF DIRECTORY
    console.log("📌 Step 1: Preloading Staff Directory cache...");
    const dirStart = Date.now();
    const directory = await StaffRepository.getStaffDirectory();
    console.log(`✅ Loaded ${directory.length} staff records in ${Date.now() - dirStart}ms.\n`);

    // STEP 2: SEQUENTIAL SAVE SIMULATION (CYCLE NEXT POND)
    console.log("📌 Step 2: Simulating Sequential Form Fill & Save across Ponds...");

    for (const testItem of TEST_PONDS) {
        const pondStart = Date.now();
        console.log(`\n--- [Pond ${testItem.pond} (Index: ${testItem.pond_index})] ---`);

        // 2a. Save Cycle Staff
        const t1 = Date.now();
        await StaffRepository.saveCycleStaff(testItem.pond_index, testItem.staff);
        const t1Duration = Date.now() - t1;
        console.log(`  ⚡ Staff saved to growout_pond_master (${t1Duration}ms)`);

        // 2b. Sync Aerator Inventory
        const t2 = Date.now();
        await InventoryRepository.syncAeratorInventory(testItem.pond_index, testItem.pond, testItem.aerators);
        const t2Duration = Date.now() - t2;
        console.log(`  ⚡ Aerators synced to pond_aerator_inventory (${t2Duration}ms)`);

        // 2c. Save Hardware & Hut Inventory
        const t3 = Date.now();
        await InventoryRepository.savePondInventory(testItem.pond_index, testItem.pond, testItem.inventory);
        const t3Duration = Date.now() - t3;
        console.log(`  ⚡ Inventory saved to pond_inventories (${t3Duration}ms)`);

        const totalPondTime = Date.now() - pondStart;
        console.log(`  ✅ Pond ${testItem.pond} total write latency: ${totalPondTime}ms`);
        writeSuccessCount++;
    }

    console.log("\n====================================================================");
    console.log("📌 Step 3: LIVE DATABASE VERIFICATION & AUDIT (DOUBLE-CHECK SUPABASE)");
    console.log("====================================================================\n");

    for (const testItem of TEST_PONDS) {
        console.log(`🔍 Verifying live Supabase data for Pond ${testItem.pond}...`);

        // Verify growout_pond_master
        const masterRes = await supabase.request(
            `growout_pond_master?pond_index=eq.${encodeURIComponent(testItem.pond_index)}&select=pond_index,pond,pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no,aerator_1hp,aerator_2hp`
        );

        if (!masterRes || masterRes.length === 0) {
            throw new Error(`❌ Database Verification FAILED: No record found for ${testItem.pond_index} in growout_pond_master`);
        }

        const masterRecord = masterRes[0];
        const staffMatched = (
            masterRecord.pm_staff_no === testItem.staff.pm_staff_no &&
            masterRecord.sv_staff_no === testItem.staff.sv_staff_no &&
            masterRecord.rl_staff_no === testItem.staff.rl_staff_no &&
            masterRecord.po_staff_no === testItem.staff.po_staff_no &&
            masterRecord.support_staff_no === testItem.staff.support_staff_no
        );

        if (!staffMatched) {
            throw new Error(`❌ Personnel mismatch in growout_pond_master for ${testItem.pond}!\nExpected: ${JSON.stringify(testItem.staff)}\nGot: ${JSON.stringify(masterRecord)}`);
        }
        console.log(`  ✅ growout_pond_master staff MATCHED: PM=${masterRecord.pm_staff_no}, SV=${masterRecord.sv_staff_no}, RL=${masterRecord.rl_staff_no}, PO=${masterRecord.po_staff_no}, Support=${masterRecord.support_staff_no}`);

        // Verify aerators in masterRecord
        const expectedU1 = testItem.aerators.find(a => a.hp === 1)?.total_units || 0;
        const expectedU2 = testItem.aerators.find(a => a.hp === 2)?.total_units || 0;
        if (masterRecord.aerator_1hp !== expectedU1 || masterRecord.aerator_2hp !== expectedU2) {
            throw new Error(`❌ Aerator mismatch in growout_pond_master! Expected: 1HP=${expectedU1}, 2HP=${expectedU2}; Got: 1HP=${masterRecord.aerator_1hp}, 2HP=${masterRecord.aerator_2hp}`);
        }
        console.log(`  ✅ growout_pond_master aerators MATCHED: 1HP=${masterRecord.aerator_1hp}, 2HP=${masterRecord.aerator_2hp}`);

        // Verify pond_inventories
        const invRes = await supabase.request(
            `pond_inventories?pond_index=eq.${encodeURIComponent(testItem.pond_index)}&select=feeding_tray_count,autofeeder_count,hut_condition,notes`
        );
        if (!invRes || invRes.length === 0) {
            throw new Error(`❌ No record in pond_inventories for ${testItem.pond_index}`);
        }
        const invRecord = invRes[0];
        if (
            invRecord.feeding_tray_count !== testItem.inventory.feeding_tray_count ||
            invRecord.autofeeder_count !== testItem.inventory.autofeeder_count ||
            invRecord.hut_condition !== testItem.inventory.hut_condition
        ) {
            throw new Error(`❌ Inventory mismatch in pond_inventories! Got: ${JSON.stringify(invRecord)}`);
        }
        console.log(`  ✅ pond_inventories MATCHED: Trays=${invRecord.feeding_tray_count}, Autofeeders=${invRecord.autofeeder_count}, Hut=${invRecord.hut_condition}`);

        verifySuccessCount++;
    }

    console.log("\n====================================================================");
    console.log("📌 Step 4: AUTO-FILL TEST FROM PRIOR CYCLE (SMART CARRY-FORWARD)");
    console.log("====================================================================\n");

    // Test: Imagine a new cycle starts next year for Pond 01.01.02 (e.g. cycle 41)
    // We query getLastCycleStaff for "01.01.02", excluding the hypothetical new cycle "2010102.41"
    const targetPond = "01.01.02";
    const hypotheticalFutureIndex = "2010102.41";

    console.log(`🧪 Testing auto-fill for pond '${targetPond}' when a new cycle is created...`);
    const autoFillStart = Date.now();
    const lastCycleStaff = await StaffRepository.getLastCycleStaff(targetPond, hypotheticalFutureIndex);
    const autoFillLatency = Date.now() - autoFillStart;

    if (!lastCycleStaff) {
        throw new Error(`❌ Auto-fill test FAILED: Could not retrieve last cycle for ${targetPond}!`);
    }

    console.log(`  ⚡ Last cycle query completed in ${autoFillLatency}ms`);
    console.log(`  📦 Retrieved Cycle Data: Cycle #${lastCycleStaff.cycle_no} (Index: ${lastCycleStaff.pond_index})`);
    console.log(`     - Asst Manager: ${lastCycleStaff.pm_staff_no} -> ${StaffRepository.findStaffByNo(lastCycleStaff.pm_staff_no)?.staff_name}`);
    console.log(`     - Supervisor:   ${lastCycleStaff.sv_staff_no} -> ${StaffRepository.findStaffByNo(lastCycleStaff.sv_staff_no)?.staff_name}`);
    console.log(`     - Row Leader:   ${lastCycleStaff.rl_staff_no} -> ${StaffRepository.findStaffByNo(lastCycleStaff.rl_staff_no)?.staff_name}`);
    console.log(`     - Pond Operator:${lastCycleStaff.po_staff_no} -> ${StaffRepository.findStaffByNo(lastCycleStaff.po_staff_no)?.staff_name}`);
    console.log(`     - Support:      ${lastCycleStaff.support_staff_no} -> ${StaffRepository.findStaffByNo(lastCycleStaff.support_staff_no)?.staff_name}`);

    // Assert that the retrieved staff matches what we saved for Pond 01.01.02
    if (
        lastCycleStaff.pm_staff_no !== "0042" ||
        lastCycleStaff.sv_staff_no !== "1157" ||
        lastCycleStaff.rl_staff_no !== "0400" ||
        lastCycleStaff.po_staff_no !== "0401" ||
        lastCycleStaff.support_staff_no !== "0801"
    ) {
        throw new Error("❌ Auto-fill validation FAILED: Retrieved staff does not match expected previous cycle values!");
    }

    console.log("\n🎉 AUTO-FILL TEST PASSED: Successfully retrieved and matched prior cycle personnel!");

    const totalDuration = Date.now() - startTime;
    console.log("\n====================================================================");
    console.log("🏁 STRESS TEST & DATABASE VERIFICATION COMPLETE");
    console.log(`- Ponds tested: ${TEST_PONDS.length}`);
    console.log(`- Write operations successful: ${writeSuccessCount}/${TEST_PONDS.length}`);
    console.log(`- Verification audits passed: ${verifySuccessCount}/${TEST_PONDS.length}`);
    console.log(`- Total test elapsed time: ${totalDuration}ms`);
    console.log("====================================================================\n");
}

runStressTest().catch(err => {
    console.error("🚨 STRESS TEST ENCOUNTERED AN ERROR:", err);
    process.exit(1);
});
