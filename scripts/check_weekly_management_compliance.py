#!/usr/bin/env python3
"""
iSHARP Platform — Weekly Operational Pond Management Compliance & Callout Auditor
Blue Archipelago Berhad • Setiu Farm (216 Commercial Ponds)

Evaluates whether Field Supervisors have updated management info for the current cycle:
1. Core Field Crew (Supervisor, Row Leader, Pond Operator present & valid in pond_staff)
2. Active Paddlewheel Aerators (Total HP > 0)
3. Hardware Inventory (Feeding Trays / Autofeeders > 0, Pond Hut condition OK / Need Repair / Urgent Repair)

Outputs a comprehensive compliance matrix and copies the WhatsApp Callout broadcast
directly to the Windows clipboard.
"""

import sys
import json
import subprocess
import datetime
import urllib.request

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

SUPABASE_URL = "https://keappoukeagyzpoxkrru.supabase.co/rest/v1"
ANON_KEY = "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s"

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json"
}

def fetch_json(endpoint):
    url = f"{SUPABASE_URL}/{endpoint}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def copy_to_clipboard(text):
    try:
        process = subprocess.Popen(["clip"], stdin=subprocess.PIPE, shell=True)
        process.communicate(text.encode("utf-8"))
        return True
    except Exception as e:
        print(f"[!] Clipboard copy warning: {e}", file=sys.stderr)
        return False

def main():
    report_date = datetime.date.today().strftime("%d %b %Y")
    print("=" * 80)
    print(f"  iSHARP WEEKLY OPERATIONAL POND MANAGEMENT AUDIT — {report_date}")
    print("  Blue Archipelago Berhad • Setiu Farm")
    print("=" * 80)
    print("Connecting to Supabase...")

    # Fetch datasets: only active production ponds (pond_status=PRODUCTION & pond_active=ACTIVE)
    try:
        cycles = fetch_json("view_growout_pond_cycles?pond_status=eq.PRODUCTION&pond_active=eq.ACTIVE&order=pond_index.desc&select=pond_index,pond,modl,row_no,cycle_no,crop_no,pond_status,pond_active,stck_date,date_close,area,aerator_1hp,aerator_2hp,stck_species,pm_staff_no,sv_staff_no,rl_staff_no,po_staff_no,support_staff_no")
        inventories = fetch_json("pond_inventories?select=pond_index,feeding_tray_count,autofeeder_count,hut_condition,notes,updated_at")
        staff_rows = fetch_json("pond_staff?select=staff_no,staff_name,staff_position,is_active")
    except Exception as e:
        print(f"[ERROR] Failed to query Supabase: {e}", file=sys.stderr)
        sys.exit(1)

    # Build staff lookup
    staff_map = {}
    for s in staff_rows:
        no = str(s.get("staff_no", "")).strip()
        if no:
            staff_map[no] = s
            unpadded = str(int(no)) if no.isdigit() else ""
            if unpadded and unpadded not in staff_map:
                staff_map[unpadded] = s

    def validate_staff(staff_no):
        if not staff_no:
            return False, None
        raw = str(staff_no).strip()
        padded = raw.zfill(4) if raw.isdigit() else raw
        match = staff_map.get(raw) or staff_map.get(padded)
        is_active = bool(match and match.get("is_active") is not False)
        return is_active, match

    # Build inventory map
    inv_map = {str(i.get("pond_index")): i for i in inventories if i.get("pond_index")}

    operational_cycles = cycles

    # Evaluate each pond
    evaluated_by_module = {}
    for cycle in operational_cycles:
        p_index = cycle.get("pond_index", "")
        p_label = cycle.get("pond", "") or (p_index.split(".")[0] if "." in p_index else p_index)
        
        # Module calculation
        mod_str = str(cycle.get("modl", "")).zfill(2)
        if (not mod_str or mod_str == "00") and "." in p_label:
            mod_str = p_label.split(".")[0].zfill(2)
        elif (not mod_str or mod_str == "00") and p_index.startswith("2"):
            mod_str = p_index[1:3]
        if not mod_str or mod_str == "00":
            mod_str = "Other"

        sv_valid, sv_obj = validate_staff(cycle.get("sv_staff_no"))
        rl_valid, rl_obj = validate_staff(cycle.get("rl_staff_no"))
        po_valid, po_obj = validate_staff(cycle.get("po_staff_no"))
        pm_valid, pm_obj = validate_staff(cycle.get("pm_staff_no")) if cycle.get("pm_staff_no") else (True, None)
        sup_valid, sup_obj = validate_staff(cycle.get("support_staff_no")) if cycle.get("support_staff_no") else (True, None)

        invalid_staff = []
        if cycle.get("sv_staff_no") and not sv_valid: invalid_staff.append(f"SV={cycle.get('sv_staff_no')}")
        if cycle.get("rl_staff_no") and not rl_valid: invalid_staff.append(f"RL={cycle.get('rl_staff_no')}")
        if cycle.get("po_staff_no") and not po_valid: invalid_staff.append(f"PO={cycle.get('po_staff_no')}")
        if cycle.get("pm_staff_no") and not pm_valid: invalid_staff.append(f"PM={cycle.get('pm_staff_no')}")
        if cycle.get("support_staff_no") and not sup_valid: invalid_staff.append(f"SUP={cycle.get('support_staff_no')}")

        has_core_staff = sv_valid and rl_valid and po_valid and not invalid_staff

        # Aerator check
        a1 = int(cycle.get("aerator_1hp") or 0)
        a2 = int(cycle.get("aerator_2hp") or 0)
        total_hp = (a1 * 1.0) + (a2 * 2.0)
        has_aerators = total_hp > 0

        # Inventory check
        inv = inv_map.get(p_index)
        trays = int(inv.get("feeding_tray_count") or 0) if inv else 0
        feeders = int(inv.get("autofeeder_count") or 0) if inv else 0
        hut = str(inv.get("hut_condition") or "").strip() if inv else ""
        has_hut = hut in ["OK", "Need Repair", "Urgent Repair"]
        has_equipment = (trays > 0 or feeders > 0)
        has_inventory = bool(inv and has_equipment and has_hut)

        # Status
        missing = []
        if not has_core_staff:
            missing_roles = []
            if not cycle.get("sv_staff_no"): missing_roles.append("SV")
            if not cycle.get("rl_staff_no"): missing_roles.append("RL")
            if not cycle.get("po_staff_no"): missing_roles.append("PO")
            if missing_roles:
                missing.append(f"Core Staff ({'/'.join(missing_roles)})")
            if invalid_staff:
                missing.append(f"Invalid Staff ID ({', '.join(invalid_staff)})")

        if not has_aerators:
            missing.append("0 HP Aeration")

        if not has_inventory:
            inv_sub = []
            if not has_equipment: inv_sub.append("Trays/Feeders")
            if not has_hut: inv_sub.append("Hut Condition")
            missing.append(f"Inventory ({', '.join(inv_sub)})")

        is_complete = has_core_staff and has_aerators and has_inventory
        has_any = bool(
            cycle.get("sv_staff_no") or cycle.get("rl_staff_no") or cycle.get("po_staff_no") or
            cycle.get("pm_staff_no") or cycle.get("support_staff_no") or
            (a1 + a2) > 0 or (inv and (trays > 0 or feeders > 0 or hut))
        )

        status = "COMPLETE" if is_complete else ("PARTIAL" if has_any else "MISSING")

        if mod_str not in evaluated_by_module:
            evaluated_by_module[mod_str] = {
                "module": mod_str,
                "sv_name": sv_obj.get("staff_name") if sv_obj else "",
                "total": 0,
                "complete": 0,
                "partial": 0,
                "missing": 0,
                "ponds": []
            }

        mod_group = evaluated_by_module[mod_str]
        mod_group["total"] += 1
        if status == "COMPLETE": mod_group["complete"] += 1
        elif status == "PARTIAL": mod_group["partial"] += 1
        else: mod_group["missing"] += 1

        if not mod_group["sv_name"] and sv_obj:
            mod_group["sv_name"] = sv_obj.get("staff_name", "")

        mod_group["ponds"].append({
            "pond": p_label,
            "status": status,
            "missing": missing,
            "sv": sv_obj.get("staff_name") if sv_obj else (cycle.get("sv_staff_no") or "None"),
            "hp": total_hp,
            "trays": trays,
            "feeders": feeders,
            "hut": hut or "Unspecified"
        })

    # Print Summary Table
    print("\nOperational Ponds Compliance Scoreboard by Module:")
    print("-" * 80)
    print(f"{'Module':<10} | {'Supervisor':<26} | {'Operational':<11} | {'Complete':<9} | {'Partial':<8} | {'Rate':<6}")
    print("-" * 80)

    total_op = 0
    total_complete = 0
    total_partial = 0
    total_missing = 0

    sorted_modules = sorted(evaluated_by_module.values(), key=lambda m: m["module"])
    for m in sorted_modules:
        total_op += m["total"]
        total_complete += m["complete"]
        total_partial += m["partial"]
        total_missing += m["missing"]
        rate = round((m["complete"] / m["total"]) * 100) if m["total"] > 0 else 0
        sv_display = (m["sv_name"][:24] + "..") if len(m["sv_name"]) > 26 else (m["sv_name"] or "Unassigned")
        print(f"Module {m['module']:<3} | {sv_display:<26} | {m['total']:<11} | {m['complete']:<9} | {m['partial']:<8} | {rate:>3}%")

    print("-" * 80)
    farm_rate = round((total_complete / total_op) * 100) if total_op > 0 else 0
    print(f"{'TOTAL':<10} | {'Setiu Farm':<26} | {total_op:<11} | {total_complete:<9} | {total_partial:<8} | {farm_rate:>3}%\n")

    # Generate Concise WhatsApp Broadcast Message
    pending_total = total_op - total_complete
    wa_lines = [
        f"📋 *iSHARP WEEKLY POND MANAGEMENT CALLOUT*",
        f"📅 *Date:* {report_date}",
        f"📊 *Farm Total:* {total_complete}/{total_op} Updated (*{farm_rate}%*) • {pending_total} Pending",
        "",
        "─────────────────────────────"
    ]

    for m in sorted_modules:
        m_rate = round((m["complete"] / m["total"]) * 100) if m["total"] > 0 else 0
        sv_header = f" • SV: {m['sv_name']}" if m['sv_name'] else ""
        m_pending = m["total"] - m["complete"]

        if m_rate == 100:
            wa_lines.append(f"📌 *MODULE {m['module']}* • {m['complete']}/{m['total']} Updated ✅ (100%){sv_header}")
            wa_lines.append("  • All operational ponds complete")
        else:
            wa_lines.append(f"📌 *MODULE {m['module']}* • {m['complete']}/{m['total']} Updated ({m_pending} Pending){sv_header}")

            # Count missing categories across unupdated ponds in this module
            m_staff = 0
            m_aerators = 0
            m_inventory = 0
            for p in m["ponds"]:
                if p["status"] != "COMPLETE":
                    p_missing = " ".join(p.get("missing", []))
                    if "Staff" in p_missing: m_staff += 1
                    if "Aeration" in p_missing or "HP" in p_missing: m_aerators += 1
                    if "Inventory" in p_missing: m_inventory += 1

            missing_cats = []
            if m_staff > 0: missing_cats.append(f"Staff ({m_staff})")
            if m_aerators > 0: missing_cats.append(f"Aerators ({m_aerators})")
            if m_inventory > 0: missing_cats.append(f"Inventory ({m_inventory})")

            missing_summary = ", ".join(missing_cats) if missing_cats else "Pending verification"
            wa_lines.append(f"  • Missing Info: {missing_summary}")
        wa_lines.append("")

    wa_lines.extend([
        "─────────────────────────────",
        "📢 *ACTION REQUIRED FOR FIELD SUPERVISORS:*",
        "Please login to *Field Operations* ➔ Open pond tile ➔ Click *Management Info* to complete:",
        "1. Core Crew (SV, RL, PO) | 2. Paddlewheel Aerators | 3. Feed Trays & Hut",
        "",
        "_iSHARP Digital Farm Management Platform_"
    ])

    wa_text = "\n".join(wa_lines)

    # Copy to clipboard
    if copy_to_clipboard(wa_text):
        print("✅ SUCCESS: Formatted WhatsApp Callout message copied to Windows clipboard!")
    else:
        print("[!] Could not auto-copy to clipboard. Printing message below.")

    print("\n" + "=" * 80)
    print("  WHATSAPP BROADCAST MESSAGE PREVIEW")
    print("=" * 80)
    print(wa_text)
    print("=" * 80)

if __name__ == "__main__":
    main()
