import test from "node:test";
import assert from "node:assert/strict";
import { DOM_IDS } from "../src/config/domContracts.js";
import { getHarvestTabHtml } from "../src/modules/dbms/templates/harvestTabTemplate.js";
import { HarvestRepository } from "../src/infrastructure/repositories/harvestRepository.js";

test("Harvest Tab Contracts: DOM_IDS contains harvest plan contracts", () => {
    assert.equal(DOM_IDS.HARVEST.TABLE_PLAN, "table-harvest-plan", "TABLE_PLAN must equal table-harvest-plan");
    assert.equal(DOM_IDS.HARVEST.TBODY_PLAN, "tbody-harvest-plan", "TBODY_PLAN must equal tbody-harvest-plan");
    assert.ok(DOM_IDS.HARVEST.TBODY_HARVEST, "TBODY_HARVEST must exist");
    assert.ok(DOM_IDS.HARVEST.TBODY_SALES, "TBODY_SALES must exist");
});

test("Harvest Tab Template: renders Harvest Plan as the first table in Harvest Records card", () => {
    const html = getHarvestTabHtml();

    // Verify all table elements exist
    assert.ok(html.includes('id="table-harvest-plan"'), "Must contain table-harvest-plan");
    assert.ok(html.includes('id="tbody-harvest-plan"'), "Must contain tbody-harvest-plan");
    assert.ok(html.includes('id="table-harvest"'), "Must contain table-harvest");
    assert.ok(html.includes('id="table-harvest-sales"'), "Must contain table-harvest-sales");

    // Verify order: table-harvest-plan appears before table-harvest
    const planIndex = html.indexOf('id="table-harvest-plan"');
    const harvestIndex = html.indexOf('id="table-harvest"');
    const salesIndex = html.indexOf('id="table-harvest-sales"');

    assert.ok(planIndex < harvestIndex, "Harvest Plan table must appear BEFORE actual Harvest Events table");
    assert.ok(harvestIndex < salesIndex, "Harvest Events table must appear BEFORE Buyer Sales table");

    // Verify column headers in Harvest Plan
    assert.ok(html.includes("Planned Date"), "Must have Planned Date header");
    assert.ok(html.includes("Plan Status"), "Must have Plan Status header");
    assert.ok(html.includes("Expected Biomass (kg)"), "Must have Expected Biomass header");
    assert.ok(html.includes("Expected ABW (g)"), "Must have Expected ABW header");
    assert.ok(html.includes("Harvest Time"), "Must have Harvest Time header");
    assert.ok(html.includes("Delivery Time"), "Must have Delivery Time header");
    assert.ok(html.includes("Team"), "Must have Team header");
});

test("HarvestRepository: exposes getHarvestPlan method", () => {
    assert.equal(typeof HarvestRepository.getHarvestPlan, "function", "getHarvestPlan must be a function");
});
