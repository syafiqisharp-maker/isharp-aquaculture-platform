/**
 * Unit Tests for Pillar 5 Offline Snapshot Read-Through Cache & SupabaseClient Failover
 */

import test from "node:test";
import assert from "node:assert/strict";
import { OfflineSnapshotCache } from "../src/infrastructure/offlineSnapshotCache.js";
import { supabase } from "../src/infrastructure/supabase.js";

test("OfflineSnapshotCache: putEndpointResponse & getEndpointResponse round-trip in memory", async () => {
    await OfflineSnapshotCache.clear();
    const endpoint = "view_growout_pond_cycles?select=*&limit=10";
    const sampleRows = [
        { pond_index: "2010101.41", pond: "01.01.01", pond_status: "PRODUCTION" },
        { pond_index: "2010102.40", pond: "01.01.02", pond_status: "IDLE" }
    ];

    await OfflineSnapshotCache.putEndpointResponse(endpoint, sampleRows);
    const hit = await OfflineSnapshotCache.getEndpointResponse(endpoint);

    assert.ok(hit, "Expected cache hit for stored endpoint");
    assert.deepEqual(hit.data, sampleRows);
    assert.ok(hit.updatedAt);
});

test("OfflineSnapshotCache: importSnapshotBundle loads Google Drive backup and serves filtered queries", async () => {
    await OfflineSnapshotCache.clear();
    const mockDriveBundle = {
        schema_version: "2.0",
        generated_at: "2026-11-01T12:00:00.000Z",
        tables: {
            view_growout_pond_cycles: [
                { pond_index: "2010101.41", pond: "01.01.01", pond_status: "PRODUCTION" },
                { pond_index: "2010102.40", pond: "01.01.02", pond_status: "CLOSE" },
                { pond_index: "2010103.41", pond: "01.01.03", pond_status: "IDLE" }
            ],
            pond_staff: [
                { staff_no: "0042", staff_name: "Ahmad" }
            ]
        }
    };

    const summary = await OfflineSnapshotCache.importSnapshotBundle(mockDriveBundle);
    assert.equal(summary.tablesImported, 2);
    assert.equal(summary.totalRows, 4);

    // Query with neq.CLOSE filter that was not explicitly cached by exact endpoint
    const activeHit = await OfflineSnapshotCache.getEndpointResponse(
        "view_growout_pond_cycles?select=pond_index,pond,pond_status&pond_status=neq.CLOSE&limit=1000"
    );
    assert.ok(activeHit);
    assert.equal(activeHit.source, "table-snapshot");
    assert.equal(activeHit.data.length, 2);
    assert.equal(activeHit.data[0].pond_index, "2010101.41");
    assert.equal(activeHit.data[1].pond_index, "2010103.41");
});

test("SupabaseClient: automatically serves cached GET data when Supabase Cloud is offline", async () => {
    await OfflineSnapshotCache.clear();
    const endpoint = "pond_staff?select=*";
    const expectedStaff = [{ staff_no: "1638", staff_name: "Hairi Azha Bin Mohd Azam" }];

    await OfflineSnapshotCache.putEndpointResponse(endpoint, expectedStaff);

    const originalFetch = globalThis.fetch;
    try {
        // Simulate total Supabase network outage
        globalThis.fetch = async () => {
            throw new TypeError("fetch failed: network offline");
        };

        const result = await supabase.request(endpoint);
        assert.deepEqual(result, expectedStaff);
        assert.equal(supabase.isOfflineFallbackActive, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
