import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FieldOpsMap } from "../src/modules/fieldOps/FieldOpsMap.js";
import { getPondWqsDetailHtml } from "../src/modules/fieldOps/templates/pondWqsDetailTemplate.js";
import { getManagementEntryHtml } from "../src/modules/fieldOps/templates/managementEntryTemplate.js";

test("FieldOps Contracts: renderPondCard uses semantic classes without inline backdrop-filter", () => {
    // Instantiate headless map instance (without document.getElementById)
    const map = Object.create(FieldOpsMap.prototype);
    map.moduleNo = 1;

    const mockData = {
        pondLabel: "01.01.01",
        cycleRecord: {
            pond: "01.01.01",
            pond_index: "2010101.40",
            cycle_no: "40",
            stck_date: "2026-07-31",
            stck_species: "P. VANNAMEI",
            area: 0.5,
            latest_do: 5.4,
            latest_ph: 7.82
        },
        isIdle: false,
        totalHP: 8,
        todayRecord: {
            feed_kg: 42.5
        },
        telemetry: {
            do_ppm: 5.6,
            ph: 7.91
        },
        abnormalParams: [
            { parameter: "Alk", value: "85", severity: "warning", message: "Alk Low" }
        ],
        feedingAction: {
            badgeText: "Normal Feed"
        },
        orbClass: "orb-emerald"
    };

    const cardHtml = map.renderPondCard(mockData);

    // 1. Verify semantic classes exist
    assert.ok(cardHtml.includes("field-ops-pond-tile pond-active"), "Should contain semantic active tile class");
    assert.ok(cardHtml.includes("pond-wqs-pills"), "Should contain pond-wqs-pills container");
    assert.ok(cardHtml.includes("pond-telemetry-pill telemetry-optimal"), "Should contain optimal telemetry pill class");
    assert.ok(cardHtml.includes("wq-abnormal-pill pill-warning"), "Should contain abnormal water quality warning badge");
    assert.ok(cardHtml.includes("Alk 85"), "Should display abnormal parameter label and value");
    assert.ok(cardHtml.includes("pond-status-banner pond-status-banner-logged"), "Should contain status banner logged class");
    assert.ok(cardHtml.includes("btn-quick-log-pond btn-quick-log-logged"), "Should contain quick log button class");

    // 2. Verify removed visual noise (Operator name removed)
    assert.ok(!cardHtml.includes("Azlan"), "Operator name must be removed from pond card");
    assert.ok(!cardHtml.includes("🦐 Unassigned"), "Unassigned operator text must be removed from pond card");

    // 3. Verify zero inline backdrop-filter in card
    assert.ok(!cardHtml.includes("backdrop-filter"), "Tile markup must NOT contain inline backdrop-filter");
});

test("FieldOps Contracts: PondWqsDetail template contains zero inline backdrop-filter", () => {
    const html = getPondWqsDetailHtml({
        pondLabel: "01.01.01",
        pond: { pond: "01.01.01", pond_index: "2010101.40", cycle_no: "40", area: 0.5 },
        isIdle: false,
        doc: 65,
        areaHa: 0.5,
        evalResult: { title: "Normal Feed", badgeText: "NORMAL", reasons: [] },
        bannerColor: "#0284c7",
        bannerBorder: "#38bdf8",
        weatherTime: "10:00 AM",
        airTemp: 31.5,
        luxVal: 80000,
        rainToday: 0.0,
        humidity: 65,
        pressure: 1010,
        totalHP: 8,
        aerationDensity: 16,
        u1: 2,
        u2: 3,
        hasWqIot: true,
        rawDo: 5.5,
        rawPh: 7.8,
        rawTemp: 29.5
    });

    assert.ok(html.includes("wqs-nav-bar"), "Should contain wqs-nav-bar class");
    assert.ok(!html.includes("backdrop-filter"), "PondWqsDetail HTML must NOT contain inline backdrop-filter");
});

test("FieldOps Contracts: ManagementEntry template contains zero inline backdrop-filter", () => {
    const html = getManagementEntryHtml({
        pondLabel: "01.01.01",
        pond: { pond: "01.01.01", pond_index: "2010101.40", cycle_no: "40" },
        doc: 65,
        initialTotalHP: 8,
        initialDensity: 16,
        u1: 2,
        u2: 3,
        staffList: [],
        pondsList: []
    });

    assert.ok(html.includes("mgmt-nav-bar"), "Should contain mgmt-nav-bar class");
    assert.ok(!html.includes("backdrop-filter"), "ManagementEntry HTML must NOT contain inline backdrop-filter");
});

test("FieldOps Contracts: CSS enforces zero blur and content-visibility on mobile", () => {
    const cssPath = path.resolve(process.cwd(), "src/styles/field-ops-mobile.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // Verify mobile media query has backdrop-filter: none
    assert.ok(cssContent.includes("backdrop-filter: none !important"), "CSS must enforce backdrop-filter: none on mobile");
    // Verify mobile media query disables wallpaper
    assert.ok(cssContent.includes("#view-field-ops::before"), "CSS must reference #view-field-ops::before");
    // Verify content containment on pond tiles
    assert.ok(cssContent.includes("content-visibility: auto"), "CSS must use content-visibility: auto for smooth scrolling");
    assert.ok(cssContent.includes("contain: layout paint"), "CSS must use contain: layout paint for performance");
});

test("FieldOps Contracts: DailyEntryModal template contains switcher IDs and water colour controls", async () => {
    const { renderDailyEntryModalMarkup } = await import("../src/modules/fieldOps/dailyRecords/dailyEntryModalTemplate.js");
    const mockPond = { pond: "09.17.05", pond_index: "2091705.41", stck_date: "2026-07-27" };
    const mockList = [
        { pond: "09.17.01", pond_index: "2091701.41" },
        { pond: "09.17.05", pond_index: "2091705.41" }
    ];

    const html = renderDailyEntryModalMarkup(mockPond, mockList, true);

    // 1. Switcher bar IDs
    assert.ok(html.includes('id="modal-switcher-pond-title"'), "Should contain modal-switcher-pond-title element");
    assert.ok(html.includes('id="modal-switcher-pond-subtitle"'), "Should contain modal-switcher-pond-subtitle element");
    assert.ok(html.includes('btn-modal-prev-pond'), "Should contain prev pond button");
    assert.ok(html.includes('btn-modal-next-pond'), "Should contain next pond button");

    // 2. Water Colour Tone controls
    assert.ok(html.includes('id="input-water-colour"'), "Should contain input-water-colour hidden input");
    assert.ok(html.includes('id="selected-water-colour-label"'), "Should contain selected-water-colour-label display");
    assert.ok(html.includes('class="water-swatch-card'), "Should contain water-swatch-card classes");
    assert.ok(html.includes('data-val="Light Green"'), "Should contain data-val attribute for Light Green");
    assert.ok(html.includes('data-val="Brownish Green"'), "Should contain data-val attribute for Brownish Green");

    // 3. No corrupted text
    assert.ok(!html.includes("â€"), "Markup must not contain double-encoded UTF-8 characters");
    assert.ok(!html.includes("Â·"), "Markup must not contain double-encoded middle dot");
});

