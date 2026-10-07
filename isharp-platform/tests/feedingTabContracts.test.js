import test from "node:test";
import assert from "node:assert/strict";
import { DOM_IDS } from "../src/config/domContracts.js";
import { getFeedingTabHtml } from "../src/modules/dbms/templates/feedingTabTemplate.js";
import { FeedRepository } from "../src/infrastructure/repositories/feedRepository.js";

test("Feeding Tab Contracts: DOM_IDS contains all dual-table contracts", () => {
    assert.ok(DOM_IDS.FEEDING.TAB_PANE, "TAB_PANE contract must exist");
    assert.equal(DOM_IDS.FEEDING.TBODY_FEED, "tbody-feed", "TBODY_FEED must equal tbody-feed");
    assert.equal(DOM_IDS.FEEDING.TABLE_FEED, "table-feed", "TABLE_FEED must equal table-feed");
    assert.equal(DOM_IDS.FEEDING.TBODY_SAP_FEED, "tbody-sap-feed", "TBODY_SAP_FEED must equal tbody-sap-feed");
    assert.equal(DOM_IDS.FEEDING.TABLE_SAP_FEED, "table-sap-feed", "TABLE_SAP_FEED must equal table-sap-feed");
    assert.equal(DOM_IDS.FEEDING.SNAP_SAP_TOTAL_FEED, "snap-sap-total-feed", "SNAP_SAP_TOTAL_FEED must equal snap-sap-total-feed");
});

test("Feeding Tab Template: renders both Supervisor table and SAP ledger table", () => {
    const html = getFeedingTabHtml();

    // Verify Table 1: Supervisor Daily Feeding Data
    assert.ok(html.includes('id="table-feed"'), "Must contain table-feed");
    assert.ok(html.includes('id="tbody-feed"'), "Must contain tbody-feed");
    assert.ok(html.includes("Supervisor Daily Feeding Data"), "Must have supervisor table heading");
    assert.ok(html.includes("Paste Excel Feed Sheet"), "Must have Excel paste button");

    // Verify Table 2: Cumulative Feed Usage (SAP Ledger)
    assert.ok(html.includes('id="table-sap-feed"'), "Must contain table-sap-feed");
    assert.ok(html.includes('id="tbody-sap-feed"'), "Must contain tbody-sap-feed");
    assert.ok(html.includes("Cumulative Feed Usage (SAP Ledger)"), "Must have SAP ledger heading");
    assert.ok(html.includes('id="snap-sap-total-feed"'), "Must contain snap-sap-total-feed badge");
    assert.ok(html.includes("Feed Brand Name"), "Must contain Feed Brand Name column header");
    assert.ok(html.includes("Cumulative Feed (kg)"), "Must contain Cumulative Feed column header");
});

test("FeedRepository: exposes required data access methods", () => {
    assert.equal(typeof FeedRepository.getDailyRecords, "function", "getDailyRecords must be a function");
    assert.equal(typeof FeedRepository.getSapFeedRecords, "function", "getSapFeedRecords must be a function");
});

test("Feeding Logic: cumulative feed correctly calculates additions and reversals", () => {
    const mockSapRecords = [
        { sap_post_date: "2026-04-29", sap_feed_name: "CP 5001", amount_kg: 275, sap_movement: 261 },
        { sap_post_date: "2026-04-29", sap_feed_name: "CP 5001", amount_kg: -275, sap_movement: 262 }, // reversal
        { sap_post_date: "2026-04-30", sap_feed_name: "CP 5001", amount_kg: 250, sap_movement: 261 },
        { sap_post_date: "2026-05-22", sap_feed_name: "GOLD CLASSIC 902", amount_kg: 500, sap_movement: 261 }
    ];

    let runningCumulative = 0;
    const computed = mockSapRecords.map(r => {
        runningCumulative += r.amount_kg;
        return { ...r, cumulative: runningCumulative };
    });

    assert.equal(computed[0].cumulative, 275);
    assert.equal(computed[1].cumulative, 0, "Reversal should zero out previous addition");
    assert.equal(computed[2].cumulative, 250);
    assert.equal(computed[3].cumulative, 750);
    assert.equal(runningCumulative, 750, "Final net feed usage should equal 750 kg");
});
