import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvCell, buildCsvString } from '../src/utils/csvExporter.js';

describe('CSV Exporter: escapeCsvCell', () => {
    it('handles null and undefined safely', () => {
        assert.equal(escapeCsvCell(null), '');
        assert.equal(escapeCsvCell(undefined), '');
    });

    it('returns regular strings and numbers unquoted', () => {
        assert.equal(escapeCsvCell('Pond01'), 'Pond01');
        assert.equal(escapeCsvCell(123.45), '123.45');
        assert.equal(escapeCsvCell(-12.5), '-12.5');
        assert.equal(escapeCsvCell('-12.5'), '-12.5');
    });

    it('escapes cells containing commas', () => {
        assert.equal(escapeCsvCell('Hello, World'), '"Hello, World"');
    });

    it('escapes double quotes by doubling them', () => {
        assert.equal(escapeCsvCell('Pond "A"'), '"Pond ""A"""');
    });

    it('escapes newlines within cells', () => {
        assert.equal(escapeCsvCell("Line1\nLine2"), '"Line1\nLine2"');
    });

    it('neutralizes OWASP CSV formula injection payloads', () => {
        assert.equal(escapeCsvCell('=CMD|\' /C calc\'!A0'), '\'=CMD|\' /C calc\'!A0');
        assert.equal(escapeCsvCell('+SUM(A1:A10)'), '\'+SUM(A1:A10)');
        assert.equal(escapeCsvCell('@SUM(A1:A10)'), '\'@SUM(A1:A10)');
        assert.equal(escapeCsvCell('-2+3'), '\'-2+3');
    });
});

describe('CSV Exporter: buildCsvString', () => {
    it('prepends UTF-8 BOM and joins rows with CRLF', () => {
        const headers = ['Pond', 'Status', 'DOC'];
        const rows = [
            ['01.01.01', 'PRODUCTION', 45],
            ['01.01.02', 'IDLE', 0]
        ];
        const result = buildCsvString(headers, rows);
        
        assert.ok(result.startsWith('\uFEFF'), 'CSV string should start with UTF-8 BOM');
        assert.ok(result.includes('Pond,Status,DOC\r\n'));
        assert.ok(result.includes('01.01.01,PRODUCTION,45\r\n'));
        assert.ok(result.includes('01.01.02,IDLE,0'));
    });
});
