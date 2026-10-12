import test from 'node:test';
import assert from 'node:assert/strict';
import { StaffRepository } from '../src/infrastructure/repositories/staffRepository.js';

test('StaffRepository: findStaff multi-mode search', async (t) => {
    // Populate fake cache representing current Supabase master directory
    StaffRepository._directoryCache = [
        { staff_no: '0042', staff_name: 'Bujang Slamat', staff_position: 'Deputy Farm Manager', is_active: true },
        { staff_no: '0397', staff_name: 'Che Zulkifli Bin Che Abdul Latif', staff_position: 'Leader, Production', is_active: true },
        { staff_no: '1638', staff_name: 'Hairi Azha Bin Mohd Azam', staff_position: 'Assistant Manager, Production', is_active: true },
        { staff_no: '2435', staff_name: 'Mohamad Ikmal Hakim bin Mohd Jeefry', staff_position: 'Supervisor Production', is_active: true },
        { staff_no: '2735', staff_name: 'Muhammad Syaqirin bin Salahuddin', staff_position: 'Farm Operator', is_active: true }
    ];

    await t.test('finds staff by unpadded ID (42 -> 0042)', () => {
        const staff = StaffRepository.findStaff('42');
        assert.ok(staff);
        assert.equal(staff.staff_no, '0042');
        assert.equal(staff.staff_name, 'Bujang Slamat');
    });

    await t.test('finds staff by 4-digit padded ID (0042)', () => {
        const staff = StaffRepository.findStaff('0042');
        assert.ok(staff);
        assert.equal(staff.staff_name, 'Bujang Slamat');
    });

    await t.test('finds staff ID 1638 accurately mapped to Hairi Azha Bin Mohd Azam', () => {
        const staff = StaffRepository.findStaff('1638');
        assert.ok(staff);
        assert.equal(staff.staff_no, '1638');
        assert.equal(staff.staff_name, 'Hairi Azha Bin Mohd Azam');
        assert.equal(staff.staff_position, 'Assistant Manager, Production');
    });

    await t.test('finds staff when user enters full or partial name', () => {
        const byFullName = StaffRepository.findStaff('Hairi Azha Bin Mohd Azam');
        assert.ok(byFullName);
        assert.equal(byFullName.staff_no, '1638');

        const byPartialName = StaffRepository.findStaff('Hairi Azha');
        assert.ok(byPartialName);
        assert.equal(byPartialName.staff_no, '1638');

        const byLastName = StaffRepository.findStaff('Syaqirin');
        assert.ok(byLastName);
        assert.equal(byLastName.staff_no, '2735');
    });

    await t.test('finds staff when selecting from HTML datalist formatted value', () => {
        const datalistSelection = '1638 - Hairi Azha Bin Mohd Azam (Assistant Manager, Production)';
        const staff = StaffRepository.findStaff(datalistSelection);
        assert.ok(staff);
        assert.equal(staff.staff_no, '1638');
        assert.equal(staff.staff_name, 'Hairi Azha Bin Mohd Azam');
    });

    await t.test('returns null for unknown ID or name', () => {
        assert.equal(StaffRepository.findStaff('9999'), null);
        assert.equal(StaffRepository.findStaff('Nonexistent Worker'), null);
        assert.equal(StaffRepository.findStaff(''), null);
    });
});
