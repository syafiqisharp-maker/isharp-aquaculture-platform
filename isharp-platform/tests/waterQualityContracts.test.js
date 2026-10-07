import test from "node:test";
import assert from "node:assert/strict";
import {
    WATER_QUALITY_THRESHOLDS,
    evaluateParameterStatus,
    getTelemetryHealthState,
    evaluateAbnormalWqParameters,
    formatParameterTarget
} from "../src/domain/waterQualityLimit.js";

test("Water Quality SSOT: Thresholds configuration matches farm operational limits", () => {
    // 1. Dissolved Oxygen (DO)
    assert.equal(WATER_QUALITY_THRESHOLDS.DO.OPTIMAL_MIN, 4.0, "DO optimal min should be 4.0 ppm");
    assert.equal(WATER_QUALITY_THRESHOLDS.DO.CAUTION_LOW, 3.0, "DO caution threshold should be 3.0 ppm");
    assert.equal(WATER_QUALITY_THRESHOLDS.DO.CRITICAL_LOW, 3.0, "DO critical low should be 3.0 ppm");

    // 2. pH Swing
    assert.equal(WATER_QUALITY_THRESHOLDS.PH_SWING.MAX_SAFE_SWING, 1.0, "pH swing safe threshold should be <= 1.0");
    assert.equal(WATER_QUALITY_THRESHOLDS.PH_SWING.SEVERE_SWING, 1.5, "pH swing severe threshold should be >= 1.5");

    // 3. Salinity
    assert.equal(WATER_QUALITY_THRESHOLDS.SALINITY.OPTIMAL_MIN, 15.0, "Salinity optimal min should be 15 ppt");
    assert.equal(WATER_QUALITY_THRESHOLDS.SALINITY.OPTIMAL_MAX, 35.0, "Salinity optimal max should be 35 ppt");
    assert.equal(WATER_QUALITY_THRESHOLDS.SALINITY.CRITICAL_LOW, 10.0, "Salinity critical low should be 10 ppt");
    assert.equal(WATER_QUALITY_THRESHOLDS.SALINITY.CRITICAL_HIGH, 38.0, "Salinity critical high should be 38 ppt");

    // 4. Ammonia (NH3)
    assert.equal(WATER_QUALITY_THRESHOLDS.AMMONIA.OPTIMAL_MAX, 1.0, "Ammonia optimal max should be 1.0 mg/L");
    assert.equal(WATER_QUALITY_THRESHOLDS.AMMONIA.CRITICAL_MIN, 2.0, "Ammonia danger threshold should be >= 2.0 mg/L");
});

test("Water Quality SSOT: evaluateParameterStatus evaluates Dissolved Oxygen correctly", () => {
    // Optimal: > 4.0 ppm
    assert.equal(evaluateParameterStatus("do", 4.5).status, "optimal");
    assert.equal(evaluateParameterStatus("do", 6.2).status, "optimal");

    // Warning: 3.0 - 4.0 ppm
    assert.equal(evaluateParameterStatus("do", 4.0).status, "warning");
    assert.equal(evaluateParameterStatus("do", 3.2).status, "warning");
    assert.equal(evaluateParameterStatus("do", 3.0).status, "warning");

    // Danger / Alert: < 3.0 ppm
    assert.equal(evaluateParameterStatus("do", 2.9).status, "alert");
    assert.equal(evaluateParameterStatus("do", 1.8).status, "alert");

    // Invalid / missing
    assert.equal(evaluateParameterStatus("do", null).status, "unknown");
    assert.equal(evaluateParameterStatus("do", "--").status, "unknown");
});

test("Water Quality SSOT: evaluateParameterStatus evaluates pH Diurnal Swing correctly", () => {
    // Safe: <= 1.0
    assert.equal(evaluateParameterStatus("ph_swing", 0.6).status, "optimal");
    assert.equal(evaluateParameterStatus("ph_swing", 1.0).status, "optimal");

    // Warning: > 1.0 and < 1.5
    assert.equal(evaluateParameterStatus("ph_swing", 1.1).status, "warning");
    assert.equal(evaluateParameterStatus("ph_swing", 1.4).status, "warning");

    // Severe: >= 1.5
    assert.equal(evaluateParameterStatus("ph_swing", 1.5).status, "alert");
    assert.equal(evaluateParameterStatus("ph_swing", 1.8).status, "alert");
});

test("Water Quality SSOT: evaluateParameterStatus evaluates Salinity correctly", () => {
    // Optimal: 15.0 - 35.0 ppt
    assert.equal(evaluateParameterStatus("salinity", 15.0).status, "optimal");
    assert.equal(evaluateParameterStatus("salinity", 25.0).status, "optimal");
    assert.equal(evaluateParameterStatus("salinity", 35.0).status, "optimal");

    // Warning: 10.0 - 14.9 ppt and 35.1 - 37.9 ppt
    assert.equal(evaluateParameterStatus("salinity", 12.0).status, "warning");
    assert.equal(evaluateParameterStatus("salinity", 10.0).status, "warning");
    assert.equal(evaluateParameterStatus("salinity", 36.5).status, "warning");
    assert.equal(evaluateParameterStatus("salinity", 37.9).status, "warning");

    // Danger: < 10.0 or >= 38.0 ppt
    assert.equal(evaluateParameterStatus("salinity", 9.8).status, "alert");
    assert.equal(evaluateParameterStatus("salinity", 38.0).status, "alert");
    assert.equal(evaluateParameterStatus("salinity", 40.0).status, "alert");
});

test("Water Quality SSOT: evaluateParameterStatus evaluates Ammonia (NH3) correctly", () => {
    // Optimal: < 1.0 mg/L
    assert.equal(evaluateParameterStatus("ammonia", 0.3).status, "optimal");
    assert.equal(evaluateParameterStatus("ammonia", 0.99).status, "optimal");

    // Warning: 1.0 - 1.99 mg/L
    assert.equal(evaluateParameterStatus("ammonia", 1.0).status, "warning");
    assert.equal(evaluateParameterStatus("ammonia", 1.5).status, "warning");
    assert.equal(evaluateParameterStatus("ammonia", 1.99).status, "warning");

    // Danger: >= 2.0 mg/L
    assert.equal(evaluateParameterStatus("ammonia", 2.0).status, "alert");
    assert.equal(evaluateParameterStatus("ammonia", 3.2).status, "alert");
});

test("Water Quality SSOT: getTelemetryHealthState returns CSS class names", () => {
    assert.equal(getTelemetryHealthState("do", 5.2), "telemetry-optimal");
    assert.equal(getTelemetryHealthState("do", 3.5), "telemetry-warning");
    assert.equal(getTelemetryHealthState("do", 2.2), "telemetry-alert");
    assert.equal(getTelemetryHealthState("do", null), "");
    assert.equal(getTelemetryHealthState("ph", 7.8), "telemetry-optimal");
    assert.equal(getTelemetryHealthState("ph", 6.8), "telemetry-alert");
});

test("Water Quality SSOT: evaluateAbnormalWqParameters extracts only abnormal values", () => {
    // 1. All parameters within optimal limits
    const safeRecord = {
        alkalinity: 120,
        ammonia: 0.2,
        nitrite: 0.1,
        salinity_ppt: 28,
        calcium: 250,
        magnesium: 700,
        turbidity: 20
    };
    const noAnomalies = evaluateAbnormalWqParameters(safeRecord);
    assert.equal(noAnomalies.length, 0, "Safe record must yield zero abnormal parameters");

    // 2. Multiple anomalies (Ammonia elevated, Salinity low, Alkalinity low)
    const troubledRecord = {
        alkalinity: 75,       // < 80 alert
        ammonia: 1.5,         // >= 1.0 warning
        nitrite: 0.2,         // <= 0.5 optimal
        salinity_ppt: 9.0,    // < 10 alert
        calcium: 210,         // >= 200 optimal
        magnesium: 620,       // >= 600 optimal
        turbidity: 25         // <= 30 optimal
    };
    const anomalies = evaluateAbnormalWqParameters(troubledRecord);
    assert.equal(anomalies.length, 3, "Should detect exactly 3 abnormal parameters");

    const alk = anomalies.find(a => a.parameter === "Alk");
    assert.ok(alk, "Should identify Alk");
    assert.equal(alk.severity, "alert");

    const nh3 = anomalies.find(a => a.parameter === "NH₃");
    assert.ok(nh3, "Should identify NH3");
    assert.equal(nh3.severity, "warning");

    const sal = anomalies.find(a => a.parameter === "Sal");
    assert.ok(sal, "Should identify Salinity");
    assert.equal(sal.severity, "alert");
});

test("Water Quality SSOT: formatParameterTarget returns target strings", () => {
    assert.equal(formatParameterTarget("do"), "> 4.0 mg/L");
    assert.equal(formatParameterTarget("ph"), "7.5–8.3 pH");
    assert.equal(formatParameterTarget("ph_swing"), "≤ 1.0 Δ/day");
    assert.equal(formatParameterTarget("salinity"), "15–35 ppt");
    assert.equal(formatParameterTarget("ammonia"), "< 1.0 mg/L");
    assert.equal(formatParameterTarget("nitrite"), "≤ 0.5 mg/L");
    assert.equal(formatParameterTarget("alkalinity"), "100–160 mg/L");
});

test("Water Quality SSOT Regression: pond 2091701.41 triggers Ammonia alert and Turbidity warning", () => {
    // Exact record for pond 2091701.41 from wet lab database
    const pond41Record = {
        id: 15473,
        pond_index: "2091701.41",
        pond: "09.17.01",
        log_date: "2026-09-30",
        doc: 65,
        salinity_ppt: 31.0,
        alkalinity: 160.0,
        ammonia: 2.0,      // Toxic >= 2.0 -> alert
        nitrite: 0.5,      // Optimal <= 0.5
        calcium: 380.0,    // Optimal >= 200
        magnesium: 1154.25,// Optimal >= 600
        turbidity: 30.9    // Elevated > 30.0 -> warning
    };

    const anomalies = evaluateAbnormalWqParameters(pond41Record);
    assert.equal(anomalies.length, 2, "Pond 2091701.41 must have exactly 2 anomalies (Ammonia & Turbidity)");

    const nh3 = anomalies.find(a => a.parameter === "NH₃");
    assert.ok(nh3, "Must detect NH3 anomaly");
    assert.equal(nh3.severity, "alert", "Ammonia 2.0 must be flagged as critical alert");
    assert.equal(nh3.value, "2.00");

    const turb = anomalies.find(a => a.parameter === "Turb");
    assert.ok(turb, "Must detect Turbidity anomaly");
    assert.equal(turb.severity, "warning", "Turbidity 30.9 must be flagged as warning");
    assert.equal(turb.value, "30.9");
});

