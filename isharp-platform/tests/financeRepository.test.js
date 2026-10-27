/**
 * Unit Tests for Finance Repository & In-Memory Calibration
 * File: tests/financeRepository.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";
import { FinanceRepository } from "../src/infrastructure/repositories/financeRepository.js";
import { supabase } from "../src/infrastructure/supabase.js";

test("FinanceRepository cache clearing and passcode detection", () => {
    // Initial state check
    assert.equal(typeof FinanceRepository.hasActivePasscode, "function");
    assert.equal(typeof FinanceRepository.clearCache, "function");

    // Setting mock passcode
    supabase.setAuthPasscode("mantaray");
    assert.equal(FinanceRepository.hasActivePasscode(), true);

    supabase.setAuthPasscode(null);
    assert.equal(FinanceRepository.hasActivePasscode(), false);
});

test("FinanceRepository getPastYearCycleFeatures handles empty results gracefully", async () => {
    FinanceRepository.clearCache();
    
    // Mock supabase request to simulate zero rows
    const originalRequest = supabase.request;
    supabase.request = async (endpoint) => {
        if (endpoint.startsWith("pond_harvest_daily")) return [];
        return [];
    };

    try {
        const features = await FinanceRepository.getPastYearCycleFeatures({ forceRefresh: true });
        assert.ok(Array.isArray(features));
        assert.equal(features.length, 0);
    } finally {
        supabase.request = originalRequest;
        FinanceRepository.clearCache();
    }
});
