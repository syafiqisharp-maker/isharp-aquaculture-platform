import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Executive Dashboard: Collapsible Section Contracts", () => {
    const execTabPath = path.resolve(__dirname, "../src/modules/executive/executiveTab.js");
    assert.ok(fs.existsSync(execTabPath), "executiveTab.js should exist");
    const content = fs.readFileSync(execTabPath, "utf-8");

    // 1. Both Section 2 and Section 3 default to collapsed
    assert.ok(
        content.includes('id="exec-production-section"') && content.includes('class="exec-section-panel exec-section-collapsible is-collapsed"'),
        "exec-production-section must have exec-section-collapsible and is-collapsed classes"
    );
    assert.ok(
        content.includes('id="exec-hatchery-perf-section"') && content.includes('class="exec-section-panel exec-section-collapsible is-collapsed"'),
        "exec-hatchery-perf-section must have exec-section-collapsible and is-collapsed classes"
    );

    // 2. Accessible ARIA attributes on headers
    assert.ok(
        content.includes('id="header-exec-production"') && content.includes('aria-expanded="false"') && content.includes('role="button"'),
        "header-exec-production must have role='button' and aria-expanded='false'"
    );
    assert.ok(
        content.includes('id="header-exec-hatchery"') && content.includes('aria-expanded="false"') && content.includes('role="button"'),
        "header-exec-hatchery must have role='button' and aria-expanded='false'"
    );

    // 3. Toggle buttons present
    assert.ok(
        content.includes('id="btn-toggle-exec-production"'),
        "btn-toggle-exec-production button must be rendered"
    );
    assert.ok(
        content.includes('id="btn-toggle-exec-hatchery"'),
        "btn-toggle-exec-hatchery button must be rendered"
    );

    // 4. Controller logic initializes collapsible handlers and action link isolation
    assert.ok(
        content.includes("initCollapsibleSections()"),
        "ExecutiveView must invoke initCollapsibleSections()"
    );
    assert.ok(
        content.includes("link-hatchery-portfolio"),
        "Hatchery portfolio link must be isolated with ID link-hatchery-portfolio"
    );
    assert.ok(
        content.includes("drawMinimalistChart"),
        "Expanding biomass section must trigger canvas redraw via drawMinimalistChart"
    );

    // 5. CSS definitions exist in farm-map.css
    const cssPath = path.resolve(__dirname, "../src/styles/components/farm-map.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    assert.ok(
        cssContent.includes(".exec-section-collapsible"),
        "farm-map.css must style .exec-section-collapsible"
    );
    assert.ok(
        cssContent.includes(".exec-collapsible-header"),
        "farm-map.css must style .exec-collapsible-header"
    );
    assert.ok(
        cssContent.includes(".exec-collapse-chevron"),
        "farm-map.css must style .exec-collapse-chevron"
    );
    assert.ok(
        cssContent.includes(".btn-section-toggle"),
        "farm-map.css must style .btn-section-toggle"
    );
    assert.ok(
        cssContent.includes(".exec-section-collapsible.is-collapsed .exec-collapsible-body"),
        "farm-map.css must hide body when collapsed"
    );
});
