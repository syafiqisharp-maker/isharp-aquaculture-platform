import test from "node:test";
import assert from "node:assert/strict";
import { security } from "../src/config/security.js";

test("Security: DBMS Password Verification", async (t) => {
    // 1. Exclusive Editor password: Only 'mantaray'
    const editorResult = await security.verifyDbmsPassword("mantaray");
    assert.equal(editorResult, "EDITOR", "mantaray should grant EDITOR access");

    // 2. Case-insensitivity & whitespace trimming
    const uppercaseResult = await security.verifyDbmsPassword("  MANTARAY  ");
    assert.equal(uppercaseResult, "EDITOR", "MANTARAY with whitespace should grant EDITOR access");

    // 3. Manager master ("todak") should grant VIEWER access to DBMS (not editor)
    const managerResult = await security.verifyDbmsPassword("todak");
    assert.equal(managerResult, "VIEWER", "todak should grant VIEWER access to DBMS");

    // 4. Viewer password ("monodon")
    const viewerResult = await security.verifyDbmsPassword("monodon");
    assert.equal(viewerResult, "VIEWER", "monodon should grant VIEWER access");

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

test("Security: Field Ops Password Verification", async (t) => {
    // 1. Module 01 specific fish password ("siakap")
    const mod1Result = await security.verifyFieldOpsPassword(1, "siakap");
    assert.equal(mod1Result, true, "siakap should unlock Module 1");

    // 2. Padded string moduleNo ("01")
    const paddedMod1Result = await security.verifyFieldOpsPassword("01", "siakap");
    assert.equal(paddedMod1Result, true, "siakap should unlock Module '01'");

    // 3. String moduleNo ("2")
    const mod2Result = await security.verifyFieldOpsPassword("2", "kerapu");
    assert.equal(mod2Result, true, "kerapu should unlock Module '2'");

    // 4. Manager master ("todak") unlocks any module
    const masterMod3Result = await security.verifyFieldOpsPassword(3, "todak");
    assert.equal(masterMod3Result, true, "todak should unlock any module");

    // 5. DBMS editor ("mantaray") unlocks any module as admin override
    const editorMod4Result = await security.verifyFieldOpsPassword(4, "mantaray");
    assert.equal(editorMod4Result, true, "mantaray should unlock any module");

    // 6. Wrong password
    const wrongModResult = await security.verifyFieldOpsPassword(1, "wrongfish");
    assert.equal(wrongModResult, false, "wrong password should be rejected");

    // 7. Wrong module for fish password (e.g. kerapu on module 1)
    const wrongModuleFish = await security.verifyFieldOpsPassword(1, "kerapu");
    assert.equal(wrongModuleFish, false, "kerapu should not unlock module 1");
});
