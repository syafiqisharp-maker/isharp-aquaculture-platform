import test from "node:test";
import assert from "node:assert/strict";
import { getManagementEntryHtml } from "../src/modules/fieldOps/templates/managementEntryTemplate.js";

test("ManagementEntry Template: renders sequential pond switcher bar and save & next button", () => {
    const mockPond = {
        pond: "01.01.01",
        pond_index: "2010101.40",
        cycle_no: "40",
        stck_date: "2026-07-31",
        area: 0.5,
        pm_staff_no: "1157",
        sv_staff_no: "1157",
        rl_staff_no: "1120",
        po_staff_no: "1216",
        support_staff_no: "2057"
    };

    const mockPondsList = [
        { pond: "01.01.01", pond_index: "2010101.40", cycle_no: "40" },
        { pond: "01.01.02", pond_index: "2010102.40", cycle_no: "40" },
        { pond: "01.01.03", pond_index: "2010103.43", cycle_no: "43" }
    ];

    const html = getManagementEntryHtml({
        pondLabel: "01.01.01",
        pond: mockPond,
        doc: 65,
        initialTotalHP: 8,
        initialDensity: 16,
        u1: 2,
        u2: 3,
        staffList: [
            { staff_no: "1157", staff_name: "Azlan", staff_position: "Supervisor" }
        ],
        pondsList: mockPondsList
    });

    // Verify Sequential Pond Switcher Bar rendered
    assert.ok(html.includes('id="mgmt-pond-switcher-bar"'), "Should contain pond switcher bar");
    assert.ok(html.includes('id="btn-mgmt-prev-pond"'), "Should contain Prev Pond button");
    assert.ok(html.includes('id="btn-mgmt-next-pond"'), "Should contain Next Pond button");
    assert.ok(html.includes("Module Pond 1 of 3"), "Should display correct pond index (1 of 3)");

    // Verify Smart Carry-Forward Banner & Copy Previous containers exist
    assert.ok(html.includes('id="mgmt-carry-forward-badge"'), "Should contain carry-forward banner container");
    assert.ok(html.includes('id="btn-mgmt-clear-autofill"'), "Should contain clear autofill button");
    assert.ok(html.includes('id="btn-copy-prev-pond"'), "Should contain copy from previous pond button");

    // Verify Action Bar buttons
    assert.ok(html.includes('id="btn-mgmt-save"'), "Should contain Save button");
    assert.ok(html.includes('id="btn-mgmt-save-next"'), "Should contain Save & Next Pond button");
});

test("ManagementEntry Template: renders without switcher bar when single pond or empty list", () => {
    const mockPond = {
        pond: "01.01.01",
        pond_index: "2010101.40",
        cycle_no: "40"
    };

    const html = getManagementEntryHtml({
        pondLabel: "01.01.01",
        pond: mockPond,
        doc: 10,
        initialTotalHP: 4,
        initialDensity: 8,
        u1: 4,
        u2: 0,
        staffList: [],
        pondsList: [mockPond]
    });

    assert.ok(!html.includes('id="mgmt-pond-switcher-bar"'), "Should not show switcher bar for single pond");
    assert.ok(!html.includes('id="btn-mgmt-save-next"'), "Should not show save & next button for single pond");
    assert.ok(html.includes('id="btn-mgmt-save"'), "Should still show standard Save button");
});
