import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { security } from "../src/config/security.js";
import { supabase } from "../src/infrastructure/supabase.js";
import { escapeHtml } from "../src/utils/formatters.js";

test("Security: Zero plaintext passwords in security.js source bundle", () => {
    const securityFilePath = path.resolve(process.cwd(), "src/config/security.js");
    const content = fs.readFileSync(securityFilePath, "utf-8").toLowerCase();

    const forbiddenPlaintexts = [
        "mantaray", "todak", "siakap", "kerapu", "jenahak",
        "haruan", "bawal", "patin", "keli", "tilapia", "tongsan"
    ];

    for (const secret of forbiddenPlaintexts) {
        assert.ok(
            !content.includes(`"${secret}"`) && !content.includes(`'${secret}'`),
            `security.js must NOT contain plaintext password '${secret}'`
        );
    }
});

test("Security: DBMS Password Verification & RLS Header Attachment", async () => {
    // 1. Exclusive Editor password: Only 'mantaray'
    const editorResult = await security.verifyDbmsPassword("mantaray");
    assert.equal(editorResult, "EDITOR", "mantaray should grant EDITOR access");
    assert.equal(supabase.getAuthPasscode(), "mantaray", "supabase client should store active passcode for RLS headers");

    // 2. Case-insensitivity & whitespace trimming
    const uppercaseResult = await security.verifyDbmsPassword("  MANTARAY  ");
    assert.equal(uppercaseResult, "EDITOR", "MANTARAY with whitespace should grant EDITOR access");

    // 3. Manager master ("todak") should grant VIEWER access to DBMS (not editor)
    const managerResult = await security.verifyDbmsPassword("todak");
    assert.equal(managerResult, "VIEWER", "todak should grant VIEWER access to DBMS");

    // 4. Viewer password ("isharp" and legacy "monodon")
    const isharpResult = await security.verifyDbmsPassword("isharp");
    assert.equal(isharpResult, "VIEWER", "isharp should grant VIEWER access");

    const monodonResult = await security.verifyDbmsPassword("monodon");
    assert.equal(monodonResult, "VIEWER", "monodon should also grant VIEWER access (backward-compatible)");

    // 5. All 9 module supervisor passcodes should grant VIEWER access to DBMS
    const moduleFishPasscodes = [
        "siakap", "kerapu", "jenahak", "haruan", "bawal",
        "patin", "keli", "tilapia", "tongsan"
    ];
    for (const fishPass of moduleFishPasscodes) {
        const res = await security.verifyDbmsPassword(fishPass);
        assert.equal(res, "VIEWER", `Fish passcode '${fishPass}' should grant VIEWER access to DBMS`);
    }

    // 6. Invalid password
    const invalidResult = await security.verifyDbmsPassword("wrong_password");
    assert.equal(invalidResult, null, "invalid password should return null");

    // 7. Empty password
    const emptyResult = await security.verifyDbmsPassword("");
    assert.equal(emptyResult, null, "empty password should return null");
});

test("Security: Field Ops Password Verification", async () => {
    // 1. Module 01 specific fish password ("siakap") -> SUPERVISOR
    const mod1Result = await security.verifyFieldOpsPassword(1, "siakap");
    assert.equal(mod1Result, "SUPERVISOR", "siakap should unlock Module 1 as SUPERVISOR");
    assert.equal(security.getFieldOpsRole(), "SUPERVISOR", "Field Ops role should be SUPERVISOR");
    assert.equal(security.canEditFieldOps(), true, "canEditFieldOps should be true for SUPERVISOR");

    // 2. Padded string moduleNo ("01")
    const paddedMod1Result = await security.verifyFieldOpsPassword("01", "siakap");
    assert.equal(paddedMod1Result, "SUPERVISOR", "siakap should unlock Module '01'");

    // 3. String moduleNo ("2")
    const mod2Result = await security.verifyFieldOpsPassword("2", "kerapu");
    assert.equal(mod2Result, "SUPERVISOR", "kerapu should unlock Module '2'");

    // 4. Manager master ("todak") unlocks any module as SUPERVISOR
    const masterMod3Result = await security.verifyFieldOpsPassword(3, "todak");
    assert.equal(masterMod3Result, "SUPERVISOR", "todak should unlock any module as SUPERVISOR");
    assert.equal(security.canEditFieldOps(), true, "canEditFieldOps should be true for manager master");

    // 5. DBMS editor ("mantaray") unlocks any module as admin override
    const editorMod4Result = await security.verifyFieldOpsPassword(4, "mantaray");
    assert.equal(editorMod4Result, "SUPERVISOR", "mantaray should unlock any module as admin");
    assert.equal(security.canEditFieldOps(), true, "canEditFieldOps should be true for admin");

    // 6. Universal viewer ("isharp" and legacy "monodon") unlocks any module as VIEWER (Read-Only)
    const viewerMod1Result = await security.verifyFieldOpsPassword(1, "isharp");
    assert.equal(viewerMod1Result, "VIEWER", "isharp should unlock Module 1 as VIEWER");
    assert.equal(security.getFieldOpsRole(), "VIEWER", "Field Ops role should be VIEWER");
    assert.equal(security.canEditFieldOps(), false, "canEditFieldOps should be false for VIEWER");

    const viewerMod9Result = await security.verifyFieldOpsPassword("09", "  ISHARP  ");
    assert.equal(viewerMod9Result, "VIEWER", "isharp with case/spacing should unlock Module 09 as VIEWER");
    assert.equal(security.canEditFieldOps(), false, "canEditFieldOps should be false for VIEWER");

    const legacyViewerResult = await security.verifyFieldOpsPassword(2, "monodon");
    assert.equal(legacyViewerResult, "VIEWER", "monodon should also unlock Module 2 as VIEWER");
    assert.equal(security.canEditFieldOps(), false, "canEditFieldOps should be false for legacy monodon");

    // 7. Wrong password
    const wrongModResult = await security.verifyFieldOpsPassword(1, "wrongfish");
    assert.equal(wrongModResult, null, "wrong password should return null");

    // 8. Wrong module for fish password (e.g. kerapu on module 1)
    const wrongModuleFish = await security.verifyFieldOpsPassword(1, "kerapu");
    assert.equal(wrongModuleFish, null, "kerapu should not unlock module 1");
});

test("Security: escapeHtml neutralizes XSS vectors", () => {
    const malicious = `<img src=x onerror="alert('xss')">&"'`;
    const escaped = escapeHtml(malicious);
    assert.equal(escaped, "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;&quot;&#39;");
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
});
