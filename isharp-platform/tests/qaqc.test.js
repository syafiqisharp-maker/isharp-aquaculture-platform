import test from "node:test";
import assert from "node:assert/strict";
import {
    formatDateWithDay,
    formatRawPondCode,
    buildHierarchicalPondTree,
    generateCleaningWhatsAppText,
    calculatePondIdleDays,
    extractShortPondNumber,
    QAQC_INSPECTORS,
    QAQC_REQUESTORS
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

test("QA/QC Domain: extractShortPondNumber", () => {
    assert.equal(extractShortPondNumber("01.01.03"), "03");
    assert.equal(extractShortPondNumber("01.01.12"), "12");
    assert.equal(extractShortPondNumber("09.18.01"), "01");
    assert.equal(extractShortPondNumber("010107"), "07");
    assert.equal(extractShortPondNumber(""), "--");
    assert.equal(extractShortPondNumber(null), "--");
});

test("QA/QC Domain: calculatePondIdleDays calculates days from date_cycle in pond_event_date", () => {
    // 2026-09-24 to 2026-10-22 = 28 days
    const ref = new Date(2026, 9, 22); // Month is 0-indexed (9 = Oct)
    assert.equal(calculatePondIdleDays("2026-09-24", ref), 28);
    // Same day = 0
    assert.equal(calculatePondIdleDays("2026-10-22", ref), 0);
    // Future date = 0
    assert.equal(calculatePondIdleDays("2026-10-25", ref), 0);
    // Missing or invalid date = 0
    assert.equal(calculatePondIdleDays(null, ref), 0);
    assert.equal(calculatePondIdleDays("", ref), 0);
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

test("QA/QC UI Template Contracts: Inspector buttons & Requestor autofill", async () => {
    const { renderPondCleaningForm } = await import("../src/modules/qaqc/templates/pondCleaningFormTemplate.js");
    const html = renderPondCleaningForm();

    // 1. Requestor autofill input & datalist
    assert.ok(html.includes('id="input-qaqc-requestor"'), "Must include input-qaqc-requestor");
    assert.ok(html.includes('list="qaqc-requestor-list"'), "Must bind to datalist qaqc-requestor-list");
    assert.ok(html.includes('id="qaqc-requestor-list"'), "Must include datalist qaqc-requestor-list");

    const requestorInputTag = html.match(/<input[^>]*id="input-qaqc-requestor"[^>]*>/)?.[0] || "";
    assert.ok(requestorInputTag, "Must find input-qaqc-requestor tag in HTML");
    assert.ok(!requestorInputTag.includes("placeholder="), "Requestor input must have no placeholder per user requirement");
    assert.ok(!requestorInputTag.includes("value="), "Requestor input must start completely blank per user requirement");

    // Verify all 16 user-specified requestor names are present in datalist
    const expectedRequestors = [
        "Pak Bujang", "Shamrin", "Rosdi", "Azlie", "Faiz", "Ranzi",
        "Ikmal", "Hasif", "Hafiz", "Izham", "Aliff", "Muiz",
        "Nazronha", "Hairi", "Rohaimi", "Syafiq"
    ];
    assert.deepEqual(QAQC_REQUESTORS, expectedRequestors);
    expectedRequestors.forEach(name => {
        assert.ok(html.includes(`value="${name}"`), `Must include datalist option for ${name}`);
    });

    // Verify legacy custom dropdown elements are removed
    assert.ok(!html.includes('id="select-qaqc-requestor"'), "Must remove legacy select-qaqc-requestor");
    assert.ok(!html.includes('id="input-qaqc-requestor-custom"'), "Must remove legacy input-qaqc-requestor-custom");

    // 2. Inspector quick-tap buttons in strict order: Helmi, Isma, Aiman, Nik, Syazwan
    assert.ok(html.includes('id="qaqc-inspector-chips"'), "Must include qaqc-inspector-chips");
    assert.deepEqual(QAQC_INSPECTORS, ["Helmi", "Isma", "Aiman", "Nik", "Syazwan"]);

    const helmiIdx = html.indexOf('data-inspector="Helmi"');
    const ismaIdx = html.indexOf('data-inspector="Isma"');
    const aimanIdx = html.indexOf('data-inspector="Aiman"');
    const nikIdx = html.indexOf('data-inspector="Nik"');
    const syazwanIdx = html.indexOf('data-inspector="Syazwan"');

    assert.ok(helmiIdx > -1, "Helmi must be present");
    assert.ok(ismaIdx > -1, "Isma must be present");
    assert.ok(aimanIdx > -1, "Aiman must be present");
    assert.ok(nikIdx > -1, "Nik must be present");
    assert.ok(syazwanIdx > -1, "Syazwan must be present");

    assert.ok(helmiIdx < ismaIdx, "Helmi must come before Isma");
    assert.ok(ismaIdx < aimanIdx, "Isma must come before Aiman");
    assert.ok(aimanIdx < nikIdx, "Aiman must come before Nik");
    assert.ok(nikIdx < syazwanIdx, "Nik must come before Syazwan");

    // 3. Clean UI: no "(For WhatsApp)" tags
    assert.ok(!html.includes("(For WhatsApp)"), "Must not contain '(For WhatsApp)' badge");
});
