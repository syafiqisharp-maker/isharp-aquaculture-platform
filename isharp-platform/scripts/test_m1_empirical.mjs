/**
 * scripts/test_m1_empirical.mjs
 * Empirical Challenge Test Suite for Milestone M1
 * Validates Supabase schema alignment, views, DML, filtering, pagination, and edge cases.
 */

import { ENV } from "../src/config/env.js";

const BASE_URL = `${ENV.SUPABASE_URL}/rest/v1`;
const HEADERS = {
    "apikey": ENV.SUPABASE_KEY,
    "Authorization": `Bearer ${ENV.SUPABASE_KEY}`,
    "Content-Type": "application/json"
};

const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
};

function recordTest(name, passed, message, metrics = null) {
    results.total++;
    if (passed) {
        results.passed++;
        console.log(`[PASS] ${name}: ${message}`);
    } else {
        results.failed++;
        console.error(`[FAIL] ${name}: ${message}`);
    }
    results.details.push({ name, passed, message, metrics });
}

async function request(endpoint, options = {}) {
    const url = `${BASE_URL}/${endpoint}`;
    const start = performance.now();
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
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    return {
        status: res.status,
        headers: res.headers,
        data,
        durationMs
    };
}

// Calculate percentiles
function calcPercentiles(latencies) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    return { min, max, avg, p50, p95, p99 };
}

async function runEmpiricalSuite() {
    console.log("==================================================================");
    console.log("   M1 EMPIRICAL CHALLENGE SUITE: SUPABASE POSTGREST AUDIT        ");
    console.log("   Target: " + ENV.SUPABASE_URL);
    console.log("==================================================================\n");

    // -------------------------------------------------------------
    // Test 1: Query public.daily_growout_records view & logged_by
    // -------------------------------------------------------------
    try {
        const res = await request("daily_growout_records?select=*&limit=5", {
            headers: { "Prefer": "count=exact" }
        });
        const contentRange = res.headers.get("content-range");
        const hasLoggedBy = Array.isArray(res.data) && res.data.length > 0 && "logged_by" in res.data[0];
        
        recordTest(
            "T1_DAILY_GROWOUT_RECORDS_READ",
            res.status === 200 && Array.isArray(res.data) && hasLoggedBy,
            `Status=${res.status}, rows=${res.data?.length}, content-range=${contentRange}, has logged_by=${hasLoggedBy}`,
            { status: res.status, latencyMs: res.durationMs }
        );
    } catch (err) {
        recordTest("T1_DAILY_GROWOUT_RECORDS_READ", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 2: Query public.pond_cycles view
    // -------------------------------------------------------------
    try {
        const res = await request("pond_cycles?select=pond_index,pond,farm,modl,crop_no,cycle_no,culture_status&limit=5", {
            headers: { "Prefer": "count=exact" }
        });
        const contentRange = res.headers.get("content-range");
        // PostgREST returns 206 Partial Content when pagination range is smaller than total count (7934 rows)
        const isSuccessStatus = res.status === 200 || res.status === 206;
        recordTest(
            "T2_POND_CYCLES_READ",
            isSuccessStatus && Array.isArray(res.data) && res.data.length === 5,
            `Status=${res.status} (200/206 Partial Content expected for range), rows=${res.data?.length}, content-range=${contentRange}`,
            { status: res.status, latencyMs: res.durationMs, contentRange }
        );
    } catch (err) {
        recordTest("T2_POND_CYCLES_READ", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 3: Filtering on pond_cycles
    // -------------------------------------------------------------
    try {
        const res = await request("pond_cycles?modl=eq.01&farm=eq.SETiU&limit=5");
        const allMatch = Array.isArray(res.data) && res.data.length > 0 && res.data.every(r => r.modl === "01" && r.farm === "SETiU");
        recordTest(
            "T3_POND_CYCLES_FILTERING",
            res.status === 200 && allMatch,
            `Filtered modl=01, farm=SETiU, returned ${res.data?.length} matching rows`,
            { status: res.status, latencyMs: res.durationMs }
        );
    } catch (err) {
        recordTest("T3_POND_CYCLES_FILTERING", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 4: Pagination on pond_cycles (limit & offset)
    // -------------------------------------------------------------
    try {
        const page1 = await request("pond_cycles?select=pond_index&order=pond_index.asc&limit=3&offset=0");
        const page2 = await request("pond_cycles?select=pond_index&order=pond_index.asc&limit=3&offset=3");
        const p1Indexes = page1.data?.map(r => r.pond_index) || [];
        const p2Indexes = page2.data?.map(r => r.pond_index) || [];
        const overlap = p1Indexes.some(id => p2Indexes.includes(id));
        recordTest(
            "T4_POND_CYCLES_PAGINATION",
            page1.status === 200 && page2.status === 200 && p1Indexes.length === 3 && p2Indexes.length === 3 && !overlap,
            `Page 1: [${p1Indexes.join(", ")}], Page 2: [${p2Indexes.join(", ")}], Overlap=${overlap}`,
            { p1Latency: page1.durationMs, p2Latency: page2.durationMs }
        );
    } catch (err) {
        recordTest("T4_POND_CYCLES_PAGINATION", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 5: Deep pagination on pond_cycles
    // -------------------------------------------------------------
    try {
        const deepPage = await request("pond_cycles?select=pond_index,pond&order=pond_index.asc&limit=5&offset=5000");
        recordTest(
            "T5_POND_CYCLES_DEEP_PAGINATION",
            deepPage.status === 200 && Array.isArray(deepPage.data) && deepPage.data.length === 5,
            `Offset 5000 fetched 5 rows in ${deepPage.durationMs.toFixed(1)}ms. First pond: ${deepPage.data?.[0]?.pond}`,
            { latencyMs: deepPage.durationMs }
        );
    } catch (err) {
        recordTest("T5_POND_CYCLES_DEEP_PAGINATION", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 6: Filtering & Ordering on daily_growout_records
    // -------------------------------------------------------------
    try {
        const res = await request("daily_growout_records?order=log_date.desc&limit=3");
        const isDescending = Array.isArray(res.data) && res.data.length >= 2 && res.data[0].log_date >= res.data[1].log_date;
        recordTest(
            "T6_DAILY_GROWOUT_RECORDS_ORDERING",
            res.status === 200 && isDescending,
            `Returned rows sorted by log_date desc: [${res.data?.map(r => r.log_date).join(", ")}]`,
            { latencyMs: res.durationMs }
        );
    } catch (err) {
        recordTest("T6_DAILY_GROWOUT_RECORDS_ORDERING", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 7: DML Insertion through daily_growout_records view
    // -------------------------------------------------------------
    const testRecord = {
        pond_index: "2010111.43",
        pond: "01.01.11",
        log_date: "2099-01-01",
        feed_kg: 77.5,
        feed_tray_remnant_pct: 15,
        water_level_cm: 120,
        water_colour: "Greenish Brown",
        mortality_count: 2,
        mortality_kg: 0.05,
        logged_by: "CHALLENGER_EMPIRICAL_TEST",
        remarks: "Inserted via daily_growout_records view probe"
    };

    let insertedId = null;
    try {
        // First clean up any leftover from previous runs
        await request(`daily_pond_records?pond_index=eq.${testRecord.pond_index}&log_date=eq.${testRecord.log_date}`, {
            method: "DELETE"
        });

        const insertRes = await request("daily_growout_records", {
            method: "POST",
            headers: {
                "Prefer": "return=representation"
            },
            body: JSON.stringify(testRecord)
        });

        if (insertRes.status === 201 && Array.isArray(insertRes.data) && insertRes.data.length > 0) {
            insertedId = insertRes.data[0].id;
            const returnedLoggedBy = insertRes.data[0].logged_by;
            recordTest(
                "T7_VIEW_INSERTION_AND_LOGGED_BY",
                returnedLoggedBy === testRecord.logged_by && !!insertedId,
                `View INSERT status=${insertRes.status}, id=${insertedId}, logged_by=${returnedLoggedBy}`,
                { latencyMs: insertRes.durationMs }
            );
        } else {
            recordTest(
                "T7_VIEW_INSERTION_AND_LOGGED_BY",
                false,
                `Insert failed: status=${insertRes.status}, data=${JSON.stringify(insertRes.data)}`
            );
        }
    } catch (err) {
        recordTest("T7_VIEW_INSERTION_AND_LOGGED_BY", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 8: Base Table Reflection of View Insert
    // -------------------------------------------------------------
    try {
        if (insertedId) {
            const baseRes = await request(`daily_pond_records?id=eq.${insertedId}`);
            const reflected = Array.isArray(baseRes.data) && baseRes.data.length === 1 && baseRes.data[0].logged_by === testRecord.logged_by;
            recordTest(
                "T8_BASE_TABLE_REFLECTION",
                reflected,
                `Base table query found record=${reflected}, logged_by=${baseRes.data?.[0]?.logged_by}`,
                { latencyMs: baseRes.durationMs }
            );
        } else {
            recordTest("T8_BASE_TABLE_REFLECTION", false, "Skipped due to failed insert");
        }
    } catch (err) {
        recordTest("T8_BASE_TABLE_REFLECTION", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 9: Update through daily_growout_records view
    // -------------------------------------------------------------
    try {
        if (insertedId) {
            const updateRes = await request(`daily_growout_records?id=eq.${insertedId}`, {
                method: "PATCH",
                headers: { "Prefer": "return=representation" },
                body: JSON.stringify({
                    remarks: "UPDATED_BY_CHALLENGER_M1",
                    feed_kg: 85.0
                })
            });

            const updated = updateRes.status === 200 && Array.isArray(updateRes.data) && updateRes.data[0].remarks === "UPDATED_BY_CHALLENGER_M1" && Number(updateRes.data[0].feed_kg) === 85.0;
            recordTest(
                "T9_VIEW_UPDATE",
                updated,
                `Update status=${updateRes.status}, updated remarks=${updateRes.data?.[0]?.remarks}, feed_kg=${updateRes.data?.[0]?.feed_kg}`,
                { latencyMs: updateRes.durationMs }
            );
        } else {
            recordTest("T9_VIEW_UPDATE", false, "Skipped due to failed insert");
        }
    } catch (err) {
        recordTest("T9_VIEW_UPDATE", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 10: Delete through daily_growout_records view & cleanup
    // -------------------------------------------------------------
    try {
        if (insertedId) {
            const delRes = await request(`daily_growout_records?id=eq.${insertedId}`, {
                method: "DELETE"
            });

            // Verify deletion in both view and base table
            const checkView = await request(`daily_growout_records?id=eq.${insertedId}`);
            const checkBase = await request(`daily_pond_records?id=eq.${insertedId}`);

            const deleted = (delRes.status === 200 || delRes.status === 204) &&
                            checkView.data?.length === 0 &&
                            checkBase.data?.length === 0;

            recordTest(
                "T10_VIEW_DELETION_AND_CLEANUP",
                deleted,
                `DELETE status=${delRes.status}, view check=${checkView.data?.length} rows, base check=${checkBase.data?.length} rows`,
                { latencyMs: delRes.durationMs }
            );
        } else {
            recordTest("T10_VIEW_DELETION_AND_CLEANUP", false, "Skipped due to failed insert");
        }
    } catch (err) {
        recordTest("T10_VIEW_DELETION_AND_CLEANUP", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 11: logged_by varchar(50) boundary test — Exactly 50 chars
    // -------------------------------------------------------------
    const exact50Chars = "A".repeat(50);
    let boundaryRecordId = null;
    try {
        const test50 = {
            pond_index: "2010111.43",
            pond: "01.01.11",
            log_date: "2099-01-02",
            logged_by: exact50Chars
        };
        const res50 = await request("daily_growout_records", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(test50)
        });

        if (res50.status === 201 && Array.isArray(res50.data) && res50.data[0].logged_by === exact50Chars) {
            boundaryRecordId = res50.data[0].id;
            recordTest(
                "T11_LOGGED_BY_EXACT_50_CHARS",
                true,
                `50-char string accepted cleanly (id=${boundaryRecordId})`,
                { latencyMs: res50.durationMs }
            );
            // Cleanup
            await request(`daily_pond_records?id=eq.${boundaryRecordId}`, { method: "DELETE" });
        } else {
            recordTest("T11_LOGGED_BY_EXACT_50_CHARS", false, `Status=${res50.status}, data=${JSON.stringify(res50.data)}`);
        }
    } catch (err) {
        recordTest("T11_LOGGED_BY_EXACT_50_CHARS", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 12: logged_by varchar(50) boundary test — 51 chars (should reject)
    // -------------------------------------------------------------
    const over50Chars = "A".repeat(51);
    try {
        const test51 = {
            pond_index: "2010111.43",
            pond: "01.01.11",
            log_date: "2099-01-03",
            logged_by: over50Chars
        };
        const res51 = await request("daily_growout_records", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(test51)
        });

        const rejected = res51.status === 400 && JSON.stringify(res51.data).includes("value too long for type character varying(50)");
        recordTest(
            "T12_LOGGED_BY_OVER_50_CHARS_REJECTED",
            rejected,
            `51-char string rejected with status=${res51.status}, error=${res51.data?.message || JSON.stringify(res51.data)}`,
            { status: res51.status }
        );
    } catch (err) {
        recordTest("T12_LOGGED_BY_OVER_50_CHARS_REJECTED", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 13: Unique constraint collision (pond_index, log_date)
    // -------------------------------------------------------------
    try {
        // 2030503.42 on 2026-09-29 already exists
        const dupRecord = {
            pond_index: "2030503.42",
            pond: "03.05.03",
            log_date: "2026-09-29",
            feed_kg: 10
        };
        const dupRes = await request("daily_growout_records", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(dupRecord)
        });

        const isConflict = dupRes.status === 409 && JSON.stringify(dupRes.data).includes("unique_pond_daily_record");
        recordTest(
            "T13_UNIQUE_CONSTRAINT_COLLISION",
            isConflict,
            `Duplicate (pond_index, log_date) rejected with 409 Conflict: ${dupRes.data?.message}`,
            { status: dupRes.status }
        );
    } catch (err) {
        recordTest("T13_UNIQUE_CONSTRAINT_COLLISION", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 14: Non-existent cycle index and empty results
    // -------------------------------------------------------------
    try {
        const emptyPond = await request("pond_cycles?pond_index=eq.NON_EXISTENT_INDEX_99999");
        recordTest(
            "T14_NON_EXISTENT_POND_QUERY",
            emptyPond.status === 200 && Array.isArray(emptyPond.data) && emptyPond.data.length === 0,
            `Non-existent pond query returns empty array [] with status=200`,
            { latencyMs: emptyPond.durationMs }
        );
    } catch (err) {
        recordTest("T14_NON_EXISTENT_POND_QUERY", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 15: Invalid filter syntax (e.g. invalid date format)
    // -------------------------------------------------------------
    try {
        const invalidDate = await request("daily_growout_records?log_date=eq.invalid-date-format");
        recordTest(
            "T15_INVALID_FILTER_SYNTAX",
            invalidDate.status === 400,
            `Invalid date syntax rejected with 400 Bad Request: ${invalidDate.data?.message}`,
            { status: invalidDate.status }
        );
    } catch (err) {
        recordTest("T15_INVALID_FILTER_SYNTAX", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 16: SQL Injection / Malicious URL Param Resilience
    // -------------------------------------------------------------
    try {
        const sqliRes = await request("pond_cycles?pond_index=eq.'+OR+'1'='1");
        recordTest(
            "T16_SQLI_RESILIENCE",
            sqliRes.status === 200 && Array.isArray(sqliRes.data) && sqliRes.data.length === 0,
            `Injection payload treated as literal string; returned 0 rows safely (status 200)`,
            { latencyMs: sqliRes.durationMs }
        );
    } catch (err) {
        recordTest("T16_SQLI_RESILIENCE", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 17: DML rejection on read-only pond_cycles view
    // -------------------------------------------------------------
    try {
        const dmlPondCycles = await request("pond_cycles", {
            method: "POST",
            body: JSON.stringify({ pond_index: "9999999.99", pond: "99.99.99" })
        });
        const isBlocked = dmlPondCycles.status >= 400;
        recordTest(
            "T17_READ_ONLY_POND_CYCLES_BLOCKED",
            isBlocked,
            `DML on pond_cycles safely blocked: status=${dmlPondCycles.status}, error=${JSON.stringify(dmlPondCycles.data)}`,
            { status: dmlPondCycles.status }
        );
    } catch (err) {
        recordTest("T17_READ_ONLY_POND_CYCLES_BLOCKED", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 18: Unicode & Operator Formats in logged_by
    // -------------------------------------------------------------
    const unicodeLoggedBy = "OP-01/AZMAN (AM) 🇲🇾";
    let unicodeRecId = null;
    try {
        const uRec = {
            pond_index: "2010111.43",
            pond: "01.01.11",
            log_date: "2099-01-10",
            logged_by: unicodeLoggedBy
        };
        const uRes = await request("daily_growout_records", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(uRec)
        });
        if (uRes.status === 201 && Array.isArray(uRes.data) && uRes.data[0].logged_by === unicodeLoggedBy) {
            unicodeRecId = uRes.data[0].id;
            recordTest(
                "T18_LOGGED_BY_UNICODE_SUPPORT",
                true,
                `Unicode and special chars stored correctly: "${uRes.data[0].logged_by}"`,
                { latencyMs: uRes.durationMs }
            );
            await request(`daily_pond_records?id=eq.${unicodeRecId}`, { method: "DELETE" });
        } else {
            recordTest("T18_LOGGED_BY_UNICODE_SUPPORT", false, `Status=${uRes.status}, data=${JSON.stringify(uRes.data)}`);
        }
    } catch (err) {
        recordTest("T18_LOGGED_BY_UNICODE_SUPPORT", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 19: PostgREST Upsert on daily_growout_records view
    // -------------------------------------------------------------
    try {
        const upsertRec1 = {
            pond_index: "2010111.43",
            pond: "01.01.11",
            log_date: "2099-01-20",
            feed_kg: 50.0,
            logged_by: "UPSERT_V1"
        };
        // Clean up first
        await request(`daily_pond_records?pond_index=eq.${upsertRec1.pond_index}&log_date=eq.${upsertRec1.log_date}`, { method: "DELETE" });

        // Initial insert
        const up1 = await request("daily_growout_records", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(upsertRec1)
        });

        // Upsert update
        const upsertRec2 = {
            pond_index: "2010111.43",
            pond: "01.01.11",
            log_date: "2099-01-20",
            feed_kg: 99.0,
            logged_by: "UPSERT_V2"
        };
        const up2 = await request("daily_growout_records?on_conflict=pond_index,log_date", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify(upsertRec2)
        });

        // Verify result
        const checkUp = await request(`daily_growout_records?pond_index=eq.2010111.43&log_date=eq.2099-01-20`);
        const isUpserted = checkUp.status === 200 && checkUp.data?.length === 1 &&
                           Number(checkUp.data[0].feed_kg) === 99.0 &&
                           checkUp.data[0].logged_by === "UPSERT_V2";

        recordTest(
            "T19_VIEW_UPSERT_MERGE_DUPLICATES",
            isUpserted,
            `Upsert status=${up2.status}, final feed_kg=${checkUp.data?.[0]?.feed_kg}, logged_by=${checkUp.data?.[0]?.logged_by}`,
            { initialStatus: up1.status, upsertStatus: up2.status }
        );

        // Cleanup
        await request(`daily_pond_records?pond_index=eq.2010111.43&log_date=eq.2099-01-20`, { method: "DELETE" });
    } catch (err) {
        recordTest("T19_VIEW_UPSERT_MERGE_DUPLICATES", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 20: logged_by Filter testing (null vs not null)
    // -------------------------------------------------------------
    try {
        const nullRes = await request("daily_growout_records?logged_by=is.null");
        const notNullRes = await request("daily_growout_records?logged_by=not.is.null");
        const filterWorking = nullRes.status === 200 && notNullRes.status === 200 &&
                              Array.isArray(nullRes.data) && Array.isArray(notNullRes.data);
        recordTest(
            "T20_LOGGED_BY_NULL_FILTERING",
            filterWorking,
            `is.null rows=${nullRes.data?.length}, not.is.null rows=${notNullRes.data?.length}`,
            { nullCount: nullRes.data?.length, notNullCount: notNullRes.data?.length }
        );
    } catch (err) {
        recordTest("T20_LOGGED_BY_NULL_FILTERING", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 21: Concurrent parallel inserts (5 parallel distinct dates)
    // -------------------------------------------------------------
    try {
        const dates = ["2099-02-11", "2099-02-12", "2099-02-13", "2099-02-14", "2099-02-15"];
        await Promise.all(dates.map(d => request(`daily_pond_records?pond_index=eq.2010111.43&log_date=eq.${d}`, { method: "DELETE" })));

        const insertPromises = dates.map((d, idx) => request("daily_growout_records", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({
                pond_index: "2010111.43",
                pond: "01.01.11",
                log_date: d,
                feed_kg: (idx + 1) * 10,
                logged_by: `CONCURRENT_OP_${idx + 1}`
            })
        }));

        const concurrentResults = await Promise.all(insertPromises);
        const all201 = concurrentResults.every(r => r.status === 201);
        const maxLatency = Math.max(...concurrentResults.map(r => r.durationMs));

        recordTest(
            "T21_CONCURRENT_PARALLEL_INSERTS",
            all201,
            `5 parallel inserts: all 201 Created = ${all201}, max latency=${maxLatency.toFixed(1)}ms`,
            { all201, maxLatency }
        );

        await Promise.all(dates.map(d => request(`daily_pond_records?pond_index=eq.2010111.43&log_date=eq.${d}`, { method: "DELETE" })));
    } catch (err) {
        recordTest("T21_CONCURRENT_PARALLEL_INSERTS", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 22: Concurrent collision test (3 parallel identical dates)
    // -------------------------------------------------------------
    try {
        const collisionDate = "2099-03-01";
        await request(`daily_pond_records?pond_index=eq.2010111.43&log_date=eq.${collisionDate}`, { method: "DELETE" });

        const collisionPromises = [1, 2, 3].map(i => request("daily_growout_records", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({
                pond_index: "2010111.43",
                pond: "01.01.11",
                log_date: collisionDate,
                feed_kg: 50.0 + i,
                logged_by: `COLLISION_OP_${i}`
            })
        }));

        const collisionResults = await Promise.all(collisionPromises);
        const statuses = collisionResults.map(r => r.status);
        const successCount = statuses.filter(s => s === 201).length;
        const conflictCount = statuses.filter(s => s === 409).length;

        const expectedResolution = successCount === 1 && conflictCount === 2;

        recordTest(
            "T22_CONCURRENT_COLLISION_HANDLING",
            expectedResolution,
            `Collision results: 201 Created=${successCount}, 409 Conflict=${conflictCount} (zero deadlocks)`,
            { statuses }
        );

        await request(`daily_pond_records?pond_index=eq.2010111.43&log_date=eq.${collisionDate}`, { method: "DELETE" });
    } catch (err) {
        recordTest("T22_CONCURRENT_COLLISION_HANDLING", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 23 & 24: Latency Profiling (25 requests to each view)
    // -------------------------------------------------------------
    console.log("\n--- Running Latency Profiling (25 requests each) ---");
    const dailyLatencies = [];
    for (let i = 0; i < 25; i++) {
        const res = await request("daily_growout_records?limit=5");
        if (res.status === 200) dailyLatencies.push(res.durationMs);
    }
    const dailyPerf = calcPercentiles(dailyLatencies);

    const cyclesLatencies = [];
    for (let i = 0; i < 25; i++) {
        const res = await request("pond_cycles?limit=10");
        if (res.status === 200 || res.status === 206) cyclesLatencies.push(res.durationMs);
    }
    const cyclesPerf = calcPercentiles(cyclesLatencies);

    recordTest(
        "T23_LATENCY_PROFILE_DAILY_GROWOUT",
        dailyPerf.p95 < 1500,
        `daily_growout_records: min=${dailyPerf.min.toFixed(1)}ms, avg=${dailyPerf.avg.toFixed(1)}ms, p50=${dailyPerf.p50.toFixed(1)}ms, p95=${dailyPerf.p95.toFixed(1)}ms, max=${dailyPerf.max.toFixed(1)}ms`,
        dailyPerf
    );

    recordTest(
        "T24_LATENCY_PROFILE_POND_CYCLES",
        cyclesPerf.p95 < 1500,
        `pond_cycles: min=${cyclesPerf.min.toFixed(1)}ms, avg=${cyclesPerf.avg.toFixed(1)}ms, p50=${cyclesPerf.p50.toFixed(1)}ms, p95=${cyclesPerf.p95.toFixed(1)}ms, max=${cyclesPerf.max.toFixed(1)}ms`,
        cyclesPerf
    );


    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log("\n==================================================================");
    console.log(`   TOTAL TESTS: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
    console.log("==================================================================");

    return results;
}

runEmpiricalSuite().then(res => {
    if (res.failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}).catch(err => {
    console.error("FATAL ERROR IN EMPIRICAL SUITE:", err);
    process.exit(1);
});
