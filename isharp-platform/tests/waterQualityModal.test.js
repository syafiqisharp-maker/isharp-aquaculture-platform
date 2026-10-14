import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { presentWaterQualityRecords, buildWaterQualityCsvData } from "../src/modules/fieldOps/waterQualityModal/waterQualityPresenter.js";
import { getWaterQualityModalHtml } from "../src/modules/fieldOps/waterQualityModal/waterQualityModalTemplate.js";
import { getPondWqsDetailHtml } from "../src/modules/fieldOps/templates/pondWqsDetailTemplate.js";

describe("Water Quality History Modal: Presenter & View-Model", () => {
    test("presentWaterQualityRecords transforms raw records and calculates Ca:Mg ratio with SSOT classes", () => {
        const raw = [
            {
                log_date: "2026-10-05",
                doc: 32,
                salinity_ppt: 30,
                alkalinity: 120,
                ammonia: 0.2,
                nitrite: 0.1,
                calcium: 260,
                magnesium: 1227,
                turbidity: 7.34
            },
            {
                log_date: "2026-10-01",
                doc: 28,
                salinity_ppt: 9, // Dangerously low (<10)
                alkalinity: 80,  // Warning low (<100)
                ammonia: 2.5,    // Dangerously high (>=2.0)
                nitrite: 1.2,    // Dangerously high (>1.0)
                calcium: 150,    // Warning low (<200)
                magnesium: 500,  // Warning low (<600)
                turbidity: 45    // Warning high (>30)
            }
        ];

        const rows = presentWaterQualityRecords(raw);
        assert.equal(rows.length, 2);

        // Record 1 - Normal / Optimal
        assert.equal(rows[0].logDate, "2026-10-05");
        assert.equal(rows[0].doc, 32);
        assert.equal(rows[0].salinity, 30);
        assert.equal(rows[0].ratioText, "1 : 4.7"); // 1227 / 260 = 4.719...
        assert.ok(rows[0].salClass.includes("text-optimal"), "Salinity 30 should be optimal");

        // Record 2 - Abnormal / Alerts
        assert.equal(rows[1].doc, 28);
        assert.equal(rows[1].salinity, 9);
        assert.ok(rows[1].salClass.includes("text-danger"), "Salinity 9 should be danger/critical");
        assert.ok(rows[1].nh3Class.includes("text-danger"), "Ammonia 2.5 should be danger/critical");
    });

    test("presentWaterQualityRecords handles empty or null values gracefully", () => {
        const rows = presentWaterQualityRecords([{}]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].logDate, "—");
        assert.equal(rows[0].doc, "—");
        assert.equal(rows[0].salinity, "—");
        assert.equal(rows[0].ratioText, "—");
    });

    test("buildWaterQualityCsvData formats RFC-4180 headers and row matrix matching DBMS 2.0", () => {
        const records = [
            {
                log_date: "2026-10-05",
                doc: 32,
                salinity_ppt: 30,
                alkalinity: 120,
                ammonia: 0.2,
                nitrite: 0.1,
                calcium: 260,
                magnesium: 1227,
                turbidity: 7.34
            }
        ];

        const { filename, headers, rows } = buildWaterQualityCsvData("01.01.01", records);
        assert.equal(filename, "Pond_01_01_01_Water_Quality_History.csv");
        assert.deepEqual(headers, [
            "Date",
            "DOC",
            "Salinity (ppt)",
            "Alkalinity (mg/L)",
            "Ammonia (mg/L)",
            "Nitrite (mg/L)",
            "Calcium (mg/L)",
            "Magnesium (mg/L)",
            "Ca : Mg Ratio",
            "Turbidity (NTU)"
        ]);

        assert.equal(rows.length, 1);
        assert.equal(rows[0][0], "2026-10-05");
        assert.equal(rows[0][1], 32);
        assert.equal(rows[0][8], "1 : 4.7");
    });
});

describe("Water Quality History Modal: Template & Accessibility Contracts", () => {
    test("template provides valid ARIA attributes, IDs, and zero inline backdrop-filter", () => {
        const html = getWaterQualityModalHtml("01.01.01", "40");

        assert.ok(html.includes('id="modal-field-ops-lab-wq"'), "Should contain main modal overlay ID");
        assert.ok(html.includes('role="dialog"'), "Must have ARIA dialog role");
        assert.ok(html.includes('aria-modal="true"'), "Must have aria-modal attribute");
        assert.ok(html.includes('aria-labelledby="modal-lab-wq-title"'), "Must link aria-labelledby");
        assert.ok(html.includes('id="btn-export-lab-wq-csv"'), "Must have CSV export button");
        assert.ok(html.includes('id="btn-close-lab-wq-modal"'), "Must have close button");
        assert.ok(html.includes('id="table-field-ops-lab-wq"'), "Must have table ID");
        assert.ok(html.includes('id="tbody-field-ops-lab-wq"'), "Must have tbody ID");

        // Verify zero inline backdrop-filter in template (Field Ops mobile rule)
        assert.ok(!html.includes("backdrop-filter:"), "Modal template must NOT contain inline backdrop-filter");
    });

    test("pondWqsDetailTemplate renders interactive hooks on all 8 Bento KPI cards", () => {
        const mockPond = {
            pond: "01.01.01",
            pond_index: "2010101.40",
            cycle_no: "40",
            stck_date: "2026-08-01",
            area: 0.5
        };

        const html = getPondWqsDetailHtml({
            pondLabel: "01.01.01",
            pond: mockPond,
            isIdle: false,
            doc: 32,
            areaHa: 0.5,
            evalResult: { level: "optimal", badgeText: "NORMAL FEED", reasons: [] },
            bannerColor: "#0369a1",
            bannerBorder: "#0284c7",
            weatherTime: "10:00 AM",
            airTemp: 31,
            luxVal: 80000,
            rainToday: 0,
            humidity: 65,
            pressure: 1009,
            totalHP: 8,
            aerationDensity: 16,
            u1: 4,
            u2: 2,
            hasWqIot: true,
            rawDo: 5.6,
            rawPh: 7.9,
            rawTemp: 29.5,
            labWq: {
                log_date: "2026-10-05",
                salinity_ppt: 30,
                alkalinity: 120,
                ammonia: 0.2,
                nitrite: 0.1,
                calcium: 260,
                magnesium: 1227,
                turbidity: 7.34
            }
        });

        // Verify all 8 cards have interactive classes and attributes
        const countInteractiveCards = (html.match(/wqs-metric-card-interactive/g) || []).length;
        const countDataActions = (html.match(/data-action="open-lab-wq-modal"/g) || []).length;

        assert.equal(countInteractiveCards, 8, "Expected 8 cards with wqs-metric-card-interactive class");
        assert.equal(countDataActions, 8, "Expected 8 cards with data-action='open-lab-wq-modal'");
    });
});
