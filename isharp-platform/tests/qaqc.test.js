import test from "node:test";
import assert from "node:assert/strict";
import {
    formatDateWithDay,
    formatRawPondCode,
    buildHierarchicalPondTree,
    generateCleaningWhatsAppText
} from "../src/domain/qaqcWhatsAppFormatter.js";

test("QA/QC Domain: formatDateWithDay", () => {
    assert.equal(formatDateWithDay("2026-10-20"), "20/10/2026 (Tue)");
    assert.equal(formatDateWithDay("2026-10-21"), "21/10/2026 (Wed)");
    assert.equal(formatDateWithDay(""), "");
    assert.equal(formatDateWithDay(null), "");
});

test("QA/QC Domain: formatRawPondCode", () => {
    assert.equal(formatRawPondCode("01.01.07"), "010107");
    assert.equal(formatRawPondCode("09.18.03"), "091803");
    assert.equal(formatRawPondCode("010107"), "010107");
    assert.equal(formatRawPondCode(""), "");
});

test("QA/QC Domain: buildHierarchicalPondTree strictly filters out PRODUCTION ponds", () => {
    const mockCycles = [
        { pond: "01.01.01", modl: "01", row_no: "01", pond_status: "PRODUCTION", pond_index: "2010101.40" },
        { pond: "01.01.02", modl: "01", row_no: "01", pond_status: "PRODUCTION", pond_index: "2010102.40" },
        { pond: "01.01.07", modl: "01", row_no: "01", pond_status: "IDLE", pond_index: "2010107.43", idle_days: 14 },
        { pond: "01.02.05", modl: "01", row_no: "02", pond_status: "MAINTENANCE", pond_index: "2010205.39" },
        { pond: "02.03.11", modl: "02", row_no: "03", pond_status: "PREPARATION", pond_index: "2020311.41" },
        { pond: "02.03.12", modl: "02", row_no: "03", pond_status: "PRODUCTION", pond_index: "2020312.41" }
    ];

    const tree = buildHierarchicalPondTree(mockCycles);

    // Module 01 should exist
    assert.ok(tree["01"]);
    // Module 01 Row 01 should only contain 01.01.07
    assert.equal(tree["01"]["01"].length, 1);
    assert.equal(tree["01"]["01"][0].pond, "01.01.07");
    assert.equal(tree["01"]["01"][0].pond_status, "IDLE");

    // Module 01 Row 02 should contain 01.02.05
    assert.equal(tree["01"]["02"].length, 1);
    assert.equal(tree["01"]["02"][0].pond, "01.02.05");

    // Module 02 Row 03 should only contain 02.03.11 (not the PRODUCTION pond)
    assert.equal(tree["02"]["03"].length, 1);
    assert.equal(tree["02"]["03"][0].pond, "02.03.11");
});

test("QA/QC Domain: generateCleaningWhatsAppText matches exact farm QA/QC format for Passed inspection", () => {
    const text = generateCleaningWhatsAppText({
        date: "2026-10-21",
        requestor: "Rosdi",
        team: "Int2",
        location: "Module 01",
        pond: "01.01.07",
        status: "PASSED",
        checklist: { lining: true, sump: true, pwa_autofeeder: true, jetty: true }
    });

    assert.ok(text.includes("*Pond cleaning Inspection*"));
    assert.ok(text.includes("Date: 21/10/2026 (Wed)"));
    assert.ok(text.includes("Requestor: Rosdi"));
    assert.ok(text.includes("Team: Int2"));
    assert.ok(text.includes("Location: Module 01"));
    assert.ok(text.includes("▶️ 010107 - Passed ✅"));
    assert.ok(text.includes("* Lining ✅"));
    assert.ok(text.includes("* Sump ✅"));
    assert.ok(text.includes("* PWA & autofeeder ✅"));
    assert.ok(text.includes("* Jetty ✅"));
    assert.ok(text.includes("Please proceed repair if required prior to disinfection after minimum of 3 days sundrying."));
    assert.ok(text.includes("Cleaning standard;"));
    assert.ok(text.includes("* Lining - brushed off sludge, algae, dead shrimp/fish/snail/barnacle"));
    assert.ok(text.includes("* Sump - clear from collected sludge, algae, dead shrimp/fish/snail"));
    assert.ok(text.includes("* PWA & autofeeder - brushed off algae/barnacle on floater & propeller"));
    assert.ok(text.includes("* Jetty - brushed off algae, dead shrimp/fish/snail/barnacle"));
});

test("QA/QC Domain: generateCleaningWhatsAppText matches format for Failed inspection with defect remarks", () => {
    const text = generateCleaningWhatsAppText({
        date: "2026-10-21",
        requestor: "Mohd Azlie",
        team: "PO 1",
        location: "Module 01",
        pond: "01.01.08",
        status: "FAILED",
        checklist: { lining: true, sump: false, pwa_autofeeder: true, jetty: true },
        remarks: "Sludge accumulated at central sump, needs re-flushing."
    });

    assert.ok(text.includes("▶️ 010108 - Failed ❌"));
    assert.ok(text.includes("* Lining ✅"));
    assert.ok(text.includes("* Sump ❌"));
    assert.ok(text.includes("* PWA & autofeeder ✅"));
    assert.ok(text.includes("* Jetty ✅"));
    assert.ok(text.includes("*Defect / Rework Note:*"));
    assert.ok(text.includes("Sludge accumulated at central sump, needs re-flushing."));
});
