import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DOM_IDS } from "../src/config/domContracts.js";
import { getLaboratoryTabHtml } from "../src/modules/dbms/templates/laboratoryTabTemplate.js";

describe("Laboratory Tab & Contracts", () => {
    test("laboratory template contains all DOM contract IDs", () => {
        const html = getLaboratoryTabHtml();
        
        for (const [key, id] of Object.entries(DOM_IDS.LABORATORY)) {
            assert.ok(
                html.includes(`id="${id}"`),
                `Expected laboratory template to contain id="${id}" for DOM_IDS.LABORATORY.${key}`
            );
        }
    });

    test("laboratory template renders both Water Chemistry and Pathology sections", () => {
        const html = getLaboratoryTabHtml();
        assert.ok(html.includes("Laboratory Water Chemistry &amp; Mineral Balance"), "Missing Water Chemistry title");
        assert.ok(html.includes("Biosecurity &amp; Disease Pathology Logbook"), "Missing Pathology title");
        assert.ok(html.includes("table-lab-wq"), "Missing water quality table");
        assert.ok(html.includes("table-issues"), "Missing issues table");
    });
});
