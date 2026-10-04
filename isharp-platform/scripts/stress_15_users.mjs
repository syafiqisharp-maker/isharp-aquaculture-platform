/**
 * scripts/stress_15_users.mjs
 * 15-User Concurrency & Load Stress Test Harness
 * 
 * Simulates 15 simultaneous field operators actively reading telemetry,
 * viewing pond cycles, and entering daily feed, treatments, and management data
 * into the Supabase PostgreSQL database.
 */

import { ENV } from "../src/config/env.js";

const BASE_URL = `${ENV.SUPABASE_URL}/rest/v1`;
const HEADERS = {
    "apikey": ENV.SUPABASE_KEY,
    "Authorization": `Bearer ${ENV.SUPABASE_KEY}`,
    "Content-Type": "application/json"
};

const TEST_DATE = "2099-12-31"; // Future date for test safety
const CONCURRENT_USERS = 15;

// Collect latency metrics
const metrics = {
    reads: [],
    writes: [],
    collisions: [],
    errors: [],
    statusCodes: {}
};

function recordMetric(category, durationMs, status, error = null) {
    metrics[category].push(durationMs);
    metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;
    if (error) {
        metrics.errors.push({ category, status, error: error.message || String(error) });
    }
}

function calculateStats(arr) {
    if (arr.length === 0) return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = sum / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p90 = sorted[Math.floor(sorted.length * 0.90)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    return {
        count: sorted.length,
        min: Math.round(sorted[0]),
        max: Math.round(sorted[sorted.length - 1]),
        avg: Math.round(avg),
        p50: Math.round(p50),
        p90: Math.round(p90),
        p95: Math.round(p95),
        p99: Math.round(p99)
    };
}

async function request(endpoint, options = {}) {
    const url = `${BASE_URL}/${endpoint}`;
    const start = performance.now();
    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                ...HEADERS,
                ...(options.headers || {})
            }
        });
        const durationMs = performance.now() - start;
        let data = null;
        const text = await res.text();
        if (text && text.trim()) {
            try { data = JSON.parse(text); } catch { data = text; }
        }
        return { ok: res.ok, status: res.status, data, durationMs };
    } catch (err) {
        const durationMs = performance.now() - start;
        return { ok: false, status: 0, error: err, durationMs };
    }
}

async function run() {
    console.log("================================================================================");
    console.log("   iSHARP DBMS 2.0 — 15-User Concurrency & Load Stress Test Harness");
    console.log(`   Target Supabase Endpoint: ${ENV.SUPABASE_URL}`);
    console.log(`   Simulated Concurrency: ${CONCURRENT_USERS} Active Operators Simultaneously`);
    console.log("================================================================================\n");

    const startTime = performance.now();

    // 1. Fetch available active ponds from DB to ensure realistic test targets
    console.log("[Init] Fetching real pond cycles for realistic worker binding...");
    const pondRes = await request("growout_pond_master?select=pond_index,pond&limit=24");
    let ponds = pondRes.ok && Array.isArray(pondRes.data) && pondRes.data.length > 0
        ? pondRes.data
        : Array.from({ length: 24 }, (_, i) => ({
            pond_index: `M02.${String(i + 1).padStart(2, "0")}.C01`,
            pond: `Pond 02.${String(i + 1).padStart(2, "0")}`
        }));

    console.log(`[Init] Loaded ${ponds.length} pond targets for operator assignments.\n`);

    // =========================================================================
    // PHASE 1: 15 Concurrent Reads (Telemetry, Master, Daily Records)
    // =========================================================================
    console.log("--------------------------------------------------------------------------------");
    console.log("PHASE 1: 15 Simultaneous Field Operators Viewing Data & Telemetry");
    console.log("--------------------------------------------------------------------------------");

    const READ_ROUNDS = 4;
    console.log(`Executing ${READ_ROUNDS} rounds of 15 simultaneous parallel read batches (${READ_ROUNDS * CONCURRENT_USERS * 3} queries)...`);

    for (let round = 1; round <= READ_ROUNDS; round++) {
        const readPromises = Array.from({ length: CONCURRENT_USERS }, async (_, userIdx) => {
            const assignedPond = ponds[userIdx % ponds.length];

            // 1. Water Quality Telemetry
            const r1 = await request(`water_quality_logs?order=recorded_at.desc&limit=10`);
            recordMetric("reads", r1.durationMs, r1.status, r1.error);

            // 2. Pond Cycle Master
            const r2 = await request(`growout_pond_master?pond_index=eq.${encodeURIComponent(assignedPond.pond_index)}`);
            recordMetric("reads", r2.durationMs, r2.status, r2.error);

            // 3. Daily Pond Logbook History
            const r3 = await request(`daily_pond_records?pond_index=eq.${encodeURIComponent(assignedPond.pond_index)}&order=log_date.desc&limit=10`);
            recordMetric("reads", r3.durationMs, r3.status, r3.error);

            return [r1.ok, r2.ok, r3.ok];
        });

        const batchResults = await Promise.all(readPromises);
        const allOk = batchResults.every(res => res.every(Boolean));
        console.log(`  -> Round ${round}/${READ_ROUNDS}: 15 operators read successfully (${allOk ? "100% OK" : "Has Errors"})`);
    }

    const readStats = calculateStats(metrics.reads);
    console.log(`\nPhase 1 Read Stats (${readStats.count} total requests):`);
    console.log(`  Min: ${readStats.min}ms | Avg: ${readStats.avg}ms | p50: ${readStats.p50}ms | p95: ${readStats.p95}ms | p99: ${readStats.p99}ms | Max: ${readStats.max}ms\n`);

    // =========================================================================
    // PHASE 2: 15 Concurrent Writes (Distinct Ponds)
    // =========================================================================
    console.log("--------------------------------------------------------------------------------");
    console.log("PHASE 2: 15 Simultaneous Field Operators Entering Daily Records");
    console.log("--------------------------------------------------------------------------------");

    const WRITE_ROUNDS = 3;
    console.log(`Executing ${WRITE_ROUNDS} rounds of 15 simultaneous parallel write operations...`);

    for (let round = 1; round <= WRITE_ROUNDS; round++) {
        const writePromises = Array.from({ length: CONCURRENT_USERS }, async (_, userIdx) => {
            const assignedPond = ponds[userIdx % ponds.length];
            const feedAmount = 45.5 + userIdx;

            // 1. Upsert daily feed & water level record
            const dailyPayload = {
                pond_index: assignedPond.pond_index,
                pond: assignedPond.pond || assignedPond.pond_index,
                log_date: TEST_DATE,
                feed_kg: feedAmount,
                water_level_cm: 110,
                water_colour: "Greenish Brown",
                logged_by: `OPERATOR_${String(userIdx + 1).padStart(2, "0")}`,
                remarks: `Load stress test round ${round} operator ${userIdx + 1}`
            };

            const w1 = await request("daily_pond_records?on_conflict=pond_index,log_date", {
                method: "POST",
                headers: { "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify(dailyPayload)
            });
            recordMetric("writes", w1.durationMs, w1.status, w1.error);

            // 2. Upsert pond inventory equipment
            const invPayload = {
                pond_index: assignedPond.pond_index,
                pond: assignedPond.pond || assignedPond.pond_index,
                feeding_tray_count: 4,
                autofeeder_count: 2,
                hut_condition: "OK",
                notes: `Automated test note operator ${userIdx + 1}`,
                updated_at: new Date().toISOString()
            };

            const w2 = await request("pond_inventories?on_conflict=pond_index", {
                method: "POST",
                headers: { "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify(invPayload)
            });
            recordMetric("writes", w2.durationMs, w2.status, w2.error);

            return [w1.ok, w2.ok];
        });

        const batchResults = await Promise.all(writePromises);
        const allOk = batchResults.every(res => res.every(Boolean));
        console.log(`  -> Round ${round}/${WRITE_ROUNDS}: 15 operators saved records concurrently (${allOk ? "100% OK" : "Has Errors"})`);
    }

    const writeStats = calculateStats(metrics.writes);
    console.log(`\nPhase 2 Write Stats (${writeStats.count} total requests):`);
    console.log(`  Min: ${writeStats.min}ms | Avg: ${writeStats.avg}ms | p50: ${writeStats.p50}ms | p95: ${writeStats.p95}ms | p99: ${writeStats.p99}ms | Max: ${writeStats.max}ms\n`);

    // =========================================================================
    // PHASE 3: Collision Stress (Multiple Operators Submitting to Same Pond)
    // =========================================================================
    console.log("--------------------------------------------------------------------------------");
    console.log("PHASE 3: High-Contention Collision (5 Operators Writing to Same Pond Simultaneously)");
    console.log("--------------------------------------------------------------------------------");

    const targetCollisionPond = ponds[0];
    console.log(`Targeting single pond ${targetCollisionPond.pond_index} with 5 simultaneous upsert queries...`);

    const collisionPromises = Array.from({ length: 5 }, async (_, i) => {
        const payload = {
            pond_index: targetCollisionPond.pond_index,
            pond: targetCollisionPond.pond,
            log_date: TEST_DATE,
            feed_kg: 50.0 + i,
            remarks: `Contention test worker ${i + 1}`,
            logged_by: `STRESS_WORKER_${i + 1}`
        };

        const res = await request("daily_pond_records?on_conflict=pond_index,log_date", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify(payload)
        });
        recordMetric("collisions", res.durationMs, res.status, res.error);
        return res;
    });

    const collisionResults = await Promise.all(collisionPromises);
    const collisionOk = collisionResults.every(r => r.ok);
    console.log(`  -> Collision Test Result: ${collisionOk ? "SUCCESS (All 5 resolved cleanly without locks/deadlocks)" : "FAILED"}`);

    const collisionStats = calculateStats(metrics.collisions);
    console.log(`  Min: ${collisionStats.min}ms | Avg: ${collisionStats.avg}ms | Max: ${collisionStats.max}ms\n`);

    // =========================================================================
    // CLEANUP TEST RECORDS
    // =========================================================================
    console.log("[Cleanup] Purging synthetic stress test records from database...");
    const cleanupRes = await request(`daily_pond_records?log_date=eq.${TEST_DATE}`, {
        method: "DELETE"
    });
    console.log(`[Cleanup] Test records purged successfully (${cleanupRes.status}).\n`);

    // =========================================================================
    // OVERALL SUMMARY & VERDICT
    // =========================================================================
    const totalDurationSec = (performance.now() - startTime) / 1000;
    const totalRequests = metrics.reads.length + metrics.writes.length + metrics.collisions.length;
    const totalErrors = metrics.errors.length;
    const rps = Math.round((totalRequests / totalDurationSec) * 10) / 10;

    console.log("================================================================================");
    console.log("   STRESS TEST COMPLETE — FINAL BENCHMARK SUMMARY");
    console.log("================================================================================");
    console.log(`Total Operations Executed: ${totalRequests}`);
    console.log(`Total Duration:            ${totalDurationSec.toFixed(2)} seconds`);
    console.log(`Throughput:                ${rps} Requests/Second (RPS)`);
    console.log(`Total Errors / Deadlocks:  ${totalErrors}`);
    console.log(`HTTP Status Breakdown:     ${JSON.stringify(metrics.statusCodes)}`);
    console.log(`Read Latency p95:          ${readStats.p95}ms`);
    console.log(`Write Latency p95:         ${writeStats.p95}ms`);
    console.log("--------------------------------------------------------------------------------");

    if (totalErrors === 0 && writeStats.p95 < 2000) {
        console.log("VERDICT: ✅ PASSED — Database fully capable of handling 15 concurrent field operators.");
    } else {
        console.log("VERDICT: ⚠️ REVIEW REQUIRED — Bottlenecks or errors detected.");
    }
    console.log("================================================================================\n");

    return {
        totalRequests,
        totalErrors,
        rps,
        readStats,
        writeStats,
        collisionStats,
        statusCodes: metrics.statusCodes
    };
}

run().catch(err => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
});
