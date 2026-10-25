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

test("ManagementEntry Template: renders staff inputs allowing ID or Name search without restrictive maxlength", () => {
    const mockPond = { pond: "01.01.01", pond_index: "2010101.40" };
    const mockStaff = [
        { staff_no: "0042", staff_name: "Bujang Slamat", staff_position: "Deputy Farm Manager" },
        { staff_no: "1157", staff_name: "Azlan", staff_position: "Supervisor" }
    ];

    const html = getManagementEntryHtml({
        pondLabel: "01.01.01",
        pond: mockPond,
        doc: 30,
        initialTotalHP: 8,
        initialDensity: 16,
        u1: 2,
        u2: 3,
        staffList: mockStaff,
        pondsList: [mockPond]
    });

    // Datalist contains ID and Name
    assert.ok(html.includes('id="mgmt-staff-datalist"'), "Should have staff datalist");
    assert.ok(html.includes('0042 - Bujang Slamat (Deputy Farm Manager)'), "Datalist option should include ID and Name");

    // Staff inputs allow Name entry (placeholder, title, and maxlength >= 50)
    const roles = ["pm", "sv", "rl", "po", "support"];
    for (const role of roles) {
        assert.ok(html.includes(`id="mgmt-${role}-id"`), `Should render input for ${role}`);
        assert.ok(html.includes(`id="mgmt-${role}-name"`), `Should render name preview for ${role}`);
    }

    assert.ok(html.includes('placeholder="ID or Name (e.g. 0042)"'), "PM input should support ID or Name");
    assert.ok(html.includes('maxlength="60"'), "Input should have generous maxlength allowing full names");
    assert.ok(!html.includes('maxlength="6"'), "Input should not restrict to 6 characters");
});
// Setup minimal Mock DOM and sessionStorage for testing ManagementEntryPage logic in Node
if (typeof globalThis.sessionStorage === "undefined") {
    const mem = new Map();
    globalThis.sessionStorage = {
        getItem: k => mem.get(k) || null,
        setItem: (k, v) => mem.set(k, String(v)),
        removeItem: k => mem.delete(k),
        clear: () => mem.clear()
    };
}
if (typeof globalThis.document === "undefined") {
    class MockElement {
        constructor(id = "") {
            this.id = id;
            this.style = {};
            this.innerHTML = "";
            this.title = "";
            this.children = new Map();
        }
        querySelector(sel) {
            if (!this.children.has(sel)) {
                this.children.set(sel, new MockElement(sel));
            }
            return this.children.get(sel);
        }
    }
    const elemMap = new Map();
    globalThis.document = {
        getElementById: id => {
            if (!elemMap.has(id)) elemMap.set(id, new MockElement(id));
            return elemMap.get(id);
        }
    };
}

import { ManagementEntryPage } from "../src/modules/fieldOps/ManagementEntryPage.js";

test("ManagementEntryPage: getCopySourceStaff resolves session cache then sequence fallback (Pond N-1)", () => {
    const page = new ManagementEntryPage("test-mgmt-container");

    // Case 1: Session storage has saved staff -> priority 1
    page.saveSessionStaff({
        pm_staff_no: "1157",
        sv_staff_no: "1157",
        rl_staff_no: "1120",
        po_staff_no: "1216",
        support_staff_no: "2057"
    }, "01.01.01");

    const sourceFromSession = page.getCopySourceStaff({ pond: "01.01.02", pond_index: "2010102.40" });
    assert.ok(sourceFromSession, "Should find copy source from session");
    assert.equal(sourceFromSession.source, "session");
    assert.equal(sourceFromSession.label, "01.01.01");
    assert.equal(sourceFromSession.staff.sv_staff_no, "1157");

    // Case 2: Session storage is cleared -> falls back to preceding pond in active module list (Pond N-1)
    page.lastSavedStaff = null;
    globalThis.sessionStorage.clear();

    page.pondsList = [
        { pond: "01.01.01", pond_index: "2010101.40", sv_staff_no: "0937", rl_staff_no: "0415", po_staff_no: "1216" },
        { pond: "01.01.02", pond_index: "2010102.40", sv_staff_no: null },
        { pond: "01.01.03", pond_index: "2010103.43", sv_staff_no: null }
    ];

    const sourceFromSeq = page.getCopySourceStaff({ pond: "01.01.02", pond_index: "2010102.40" });
    assert.ok(sourceFromSeq, "Should find copy source from preceding pond");
    assert.equal(sourceFromSeq.source, "sequence");
    assert.equal(sourceFromSeq.label, "01.01.01");
    assert.equal(sourceFromSeq.staff.sv_staff_no, "0937");
    assert.equal(sourceFromSeq.staff.rl_staff_no, "0415");

    // Case 3: First pond in list with empty session -> returns null (no preceding pond)
    const sourceFirstPond = page.getCopySourceStaff({ pond: "01.01.01", pond_index: "2010101.40" });
    assert.equal(sourceFirstPond, null, "First pond should return null when session is empty");
});

test("ManagementEntryPage: updateCopyPrevButton updates button visibility and label correctly", () => {
    const page = new ManagementEntryPage("test-mgmt-container-2");
    page.saveSessionStaff({
        sv_staff_no: "1157",
        rl_staff_no: "1120",
        po_staff_no: "1216"
    }, "01.01.01");

    page.updateCopyPrevButton({ pond: "01.01.02", pond_index: "2010102.40" });

    const container = page.container.querySelector("#mgmt-copy-prev-container");
    const btn = page.container.querySelector("#btn-copy-prev-pond");

    assert.equal(container.style.display, "block", "Container should be visible");
    assert.ok(btn.innerHTML.includes("Copy from Pond 01.01.01"), "Button should show pond label");
    assert.ok(btn.title.includes("01.01.01"), "Button title should include pond label");
});
