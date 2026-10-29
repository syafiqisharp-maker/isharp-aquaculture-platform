"""
Telaga Putat Hatchery (TPH) — Excel Parsers & Data Normalization Engine
"""

import re
import datetime
from openpyxl.utils import column_index_from_string as col_idx
from hatchery_config import SOURCE_MAP, MAT_SHEET_MAP

def clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None

def clean_float(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "")
    if not s or s in ("-", "ND", "N/A", "nil", "NA", "None", "#N/A", "#REF!", "#DIV/0!"):
        return None
    try:
        return float(s)
    except ValueError:
        return None

def clean_int(val):
    f = clean_float(val)
    return int(round(f)) if f is not None else None

def clean_date(val):
    if val is None:
        return None
    if isinstance(val, datetime.datetime):
        return val.date().isoformat()
    if isinstance(val, datetime.date):
        return val.isoformat()
    s = str(val).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None

def parse_stage_number(val):
    if val is None:
        return None
    s = str(val).strip()
    m = re.search(r"(\d+)", s)
    if m:
        return int(m.group(1))
    return None

def generate_64_tanks():
    """Generates the 64 PL tanks in blocks A, B, C, D."""
    tanks = []
    for b in ['A', 'B', 'C', 'D']:
        for n in range(1, 17):
            t_code = f"{b}{n:02d}"
            is_top = (n >= 9)
            row_pos = "TOP" if is_top else "BOTTOM"
            col_pos = (n - 8) if is_top else (9 - n)
            tanks.append({
                "tank_code": t_code,
                "block": b,
                "tank_no": n,
                "row_pos": row_pos,
                "col_pos": col_pos,
                "is_active": True
            })
    return tanks

def parse_batch_sheet(ws, sheet_name):
    """
    Parses a single broodstock batch sheet using ultra-fast iter_rows (2024-2026 format).
    Returns (batch_meta, block_assignments, daily_records, allocations).
    """
    if sheet_name not in MAT_SHEET_MAP:
        return None, [], [], []

    batch_code = MAT_SHEET_MAP[sheet_name]
    
    # Read rows up to row 300 in one ultra-fast pass (0.2s)
    raw_rows = list(ws.iter_rows(min_row=1, max_row=300, values_only=True))
    if len(raw_rows) < 24:
        return None, [], [], []

    # 1. Header Information (Rows 10 - 16, 0-indexed: rows 9 - 15)
    supplier = clean_str(raw_rows[10][1]) if len(raw_rows[10]) > 1 else "Unknown Supplier"
    species = clean_str(raw_rows[11][1]) if len(raw_rows[11]) > 1 else "L.Vannamei"
    arrival_date = clean_date(raw_rows[12][1]) if len(raw_rows[12]) > 1 else None
    arrival_time = clean_str(raw_rows[13][1]) if len(raw_rows[13]) > 1 else None
    abw_female = clean_float(raw_rows[14][1]) if len(raw_rows[14]) > 1 else None
    abw_male = clean_float(raw_rows[15][1]) if len(raw_rows[15]) > 1 else None

    # Induk Datang Summary (Row 22, 0-indexed: row 21)
    arrived_pop_f = clean_int(raw_rows[21][1]) if len(raw_rows[21]) > 1 else None
    arrived_pop_m = clean_int(raw_rows[21][2]) if len(raw_rows[21]) > 2 else None

    batch_meta = {
        "batch_code": batch_code,
        "source_code": batch_code,
        "supplier": supplier or "Unknown Supplier",
        "species": species or "L.Vannamei",
        "arrival_date": arrival_date or "2024-01-01",
        "arrival_time": arrival_time,
        "abw_female_g": abw_female,
        "abw_male_g": abw_male,
        "arrived_pop_female": arrived_pop_f,
        "arrived_pop_male": arrived_pop_m,
        "ablation_date": None,
        "mat_sheet_name": sheet_name
    }

    daily_records = []
    allocations = []
    block_dates = {}

    # Daily records start from row 24 (0-indexed: index 23)
    for r_idx in range(23, len(raw_rows)):
        row = raw_rows[r_idx]
        if not row or not row[0]:
            continue
        rec_date = clean_date(row[0])
        if not rec_date:
            continue

        # Derived block tracking (Col BK = 63, 0-indexed: index 62)
        spawn_bk = clean_str(row[62]) if len(row) > 62 else None
        block = None
        if spawn_bk:
            if "SHA" in spawn_bk.upper():
                block = "A"
            elif "SHB" in spawn_bk.upper():
                block = "B"
            if block:
                block_dates.setdefault(block, []).append(rec_date)

        def cell_val(col_letter):
            idx = col_idx(col_letter) - 1
            return row[idx] if idx < len(row) else None

        # Robust 0-based DOC calculation (Option 1): rec_date - arrival_date
        calc_doc = None
        if arrival_date and rec_date:
            try:
                d_arr = datetime.date.fromisoformat(arrival_date)
                d_rec = datetime.date.fromisoformat(rec_date)
                calc_doc = max(0, (d_rec - d_arr).days)
            except Exception:
                calc_doc = None
        if calc_doc is None:
            calc_doc = clean_int(cell_val('BA')) or 0

        daily_rec = {
            "batch_code": batch_code,
            "rec_date": rec_date,
            "mat_pop_female": clean_int(cell_val('K')),
            "mat_pop_male": clean_int(cell_val('L')),
            "mat_mort_female": clean_int(cell_val('M')),
            "mat_mort_male": clean_int(cell_val('N')),
            "mat_mort_female_pct": clean_float(cell_val('O')),
            "mat_mort_male_pct": clean_float(cell_val('P')),
            "spawning_count": clean_int(cell_val('Y')),
            "spawning_female_pct": clean_float(cell_val('Z')),
            "eggs_k": clean_float(cell_val('AA')),
            "fertilization_rate_pct": clean_float(cell_val('AB')),
            "avg_eggs_per_female": clean_float(cell_val('AC')),
            "nauplii_gross_k": clean_float(cell_val('AD')),
            "hr_a_pct": clean_float(cell_val('AE')),
            "hr_b_pct": clean_float(cell_val('AF')),
            "avg_nauplii_per_female_k": clean_float(cell_val('AG')),
            "overstock_k": clean_float(cell_val('AI')),
            "nauplii_transfer_k": clean_float(cell_val('AJ')),
            "nauplii_allowance_k": clean_float(cell_val('AK')),
            "nauplii_stocking_k": clean_float(cell_val('AL')),
            "doc": calc_doc,
            "dop": clean_int(cell_val('BB')),
            "stocking_target_date": clean_date(cell_val('BC')),
            "distribution_tph_k": clean_float(cell_val('BD')),
            "distribution_tank_list": clean_str(cell_val('BG')),
            "spawn_block": spawn_bk
        }
        daily_records.append(daily_rec)

        stck_target = daily_rec["stocking_target_date"]
        dist_tph = daily_rec["distribution_tph_k"]
        dist_tanks_raw = daily_rec["distribution_tank_list"]

        if dist_tanks_raw and stck_target and dist_tph and dist_tph > 0:
            ignored_tokens = ("NO STOCKING", "QUARANTINE", "NO SOURCING", "0")
            if not any(token in dist_tanks_raw.upper() for token in ignored_tokens):
                matches = re.findall(r"([A-D])\s*[-_]?\s*(1[0-6]|0?[1-9])(?![0-9])", dist_tanks_raw, re.I)
                tank_codes = [f"{b.upper()}{int(n):02d}" for b, n in matches]
                if tank_codes:
                    share_k = round(dist_tph / len(tank_codes), 2)
                    for t_code in tank_codes:
                        allocations.append({
                            "batch_code": batch_code,
                            "rec_date": rec_date,
                            "tank_code": t_code,
                            "stocking_date": stck_target,
                            "raw_tank_list": dist_tanks_raw,
                            "total_batch_stocking_k": dist_tph,
                            "allocated_nauplii_k": share_k,
                            "allocation_method": "PRORATA"
                        })

    block_assignments = []
    for blk, d_list in block_dates.items():
        if d_list:
            block_assignments.append({
                "batch_code": batch_code,
                "block": blk,
                "start_date": min(d_list),
                "end_date": max(d_list),
                "derived_from_spawning": True
            })

    return batch_meta, block_assignments, daily_records, allocations


def parse_summary_sheet1(ws):
    """
    Parses Sheet1 of Summary report using ultra-fast iter_rows.
    Groups rows by (tank_code, stock_date) into runs and events.
    Returns (runs, events, commercial_records, import_logs).
    """
    rows_by_run = {}
    import_logs = []

    raw_rows = list(ws.iter_rows(min_row=4, max_row=2000, values_only=True))

    for r_offset, row in enumerate(raw_rows):
        r = 4 + r_offset
        if not row or len(row) < 5:
            continue
        raw_tank = clean_str(row[3])
        raw_stock_date = row[4]
        stock_date = clean_date(raw_stock_date)

        if not raw_tank and not stock_date:
            continue

        tank_code = raw_tank.upper() if raw_tank else None
        if not tank_code or not re.match(r"^[A-D]\d{2}$", tank_code) or not stock_date:
            import_logs.append({
                "file_name": "Summary report 2024_2026_complete.xlsx",
                "sheet_name": "Sheet1",
                "row_no": r,
                "severity": "WARN",
                "code": "INVALID_RUN_IDENTIFIER",
                "message": f"Skipped row {r}: tank={raw_tank}, stock_date={raw_stock_date}"
            })
            continue

        run_key = (tank_code, stock_date)
        rows_by_run.setdefault(run_key, []).append((r, row))

    runs = []
    events = []
    commercial_records = []

    for (tank_code, stock_date), row_items in rows_by_run.items():
        first_r, first_row = row_items[0]
        
        species_raw = clean_str(first_row[7]) or "VANNAMEI"
        species = "MON" if "MON" in species_raw.upper() else "VAN"

        raw_source = clean_str(first_row[6])
        source_code = SOURCE_MAP.get(raw_source) if raw_source else None
        if not source_code:
            source_code = "UNKNOWN"
            import_logs.append({
                "file_name": "Summary report 2024_2026_complete.xlsx",
                "sheet_name": "Sheet1",
                "row_no": first_r,
                "severity": "REVIEW",
                "code": "UNKNOWN_SOURCE_SPELLING",
                "message": f"Unrecognized nauplii source '{raw_source}' for {tank_code} on {stock_date}"
            })

        stocking_vals = [clean_float(item[1][5]) for item in row_items if clean_float(item[1][5]) is not None]
        nauplii_stocked_k = stocking_vals[0] if stocking_vals else None

        has_culture = False
        harvest_dates = []
        harvested_total_k = 0.0
        flushed_total_k = 0.0
        reported_sr_list = []
        flags = []

        if nauplii_stocked_k is None:
            flags.append("QTY_PENDING")

        for occ_idx, (r_no, r_cells) in enumerate(row_items, 1):
            row_status = clean_str(r_cells[8]) or ""
            row_status_upper = row_status.upper()

            lot_no = clean_str(r_cells[9]) if len(r_cells) > 9 else None

            hvt_date = clean_date(r_cells[10]) if len(r_cells) > 10 else None
            hvt_stage = parse_stage_number(r_cells[11]) if len(r_cells) > 11 else None
            hvt_qty = clean_float(r_cells[12]) if len(r_cells) > 12 else None
            hvt_sr = clean_float(r_cells[13]) if len(r_cells) > 13 else None
            buyer = clean_str(r_cells[14]) if len(r_cells) > 14 else None
            do_no = clean_str(r_cells[15]) if len(r_cells) > 15 else None
            ext_buyer = clean_str(r_cells[22]) if len(r_cells) > 22 else None

            flsh_date = clean_date(r_cells[17]) if len(r_cells) > 17 else None
            flsh_stage = parse_stage_number(r_cells[18]) if len(r_cells) > 18 else None
            flsh_qty = clean_float(r_cells[19]) if len(r_cells) > 19 else None
            flsh_type = clean_str(r_cells[20]) if len(r_cells) > 20 else None
            flsh_reason = clean_str(r_cells[21]) if len(r_cells) > 21 else None

            if "CULTURE" in row_status_upper:
                has_culture = True
                events.append({
                    "tank_code": tank_code,
                    "stock_date": stock_date,
                    "event_type": "CULTURE",
                    "event_date": stock_date,
                    "pl_stage": 0,
                    "qty_k": 0.0,
                    "occurrence_no": occ_idx,
                    "lot_no": lot_no,
                    "source_sheet": "Sheet1",
                    "source_row": r_no
                })
            
            if hvt_qty and hvt_qty > 0 and hvt_date:
                harvest_dates.append(hvt_date)
                harvested_total_k += hvt_qty
                if hvt_sr is not None:
                    reported_sr_list.append(hvt_sr)
                
                events.append({
                    "tank_code": tank_code,
                    "stock_date": stock_date,
                    "event_type": "HARVEST",
                    "event_date": hvt_date,
                    "pl_stage": hvt_stage or 15,
                    "qty_k": hvt_qty,
                    "occurrence_no": occ_idx,
                    "sr_reported_pct": hvt_sr,
                    "lot_no": lot_no,
                    "source_sheet": "Sheet1",
                    "source_row": r_no
                })

                clean_b = buyer.upper() if buyer else None
                if clean_b and clean_b in ("1723", "1725", "1726"):
                    clean_b = None
                
                commercial_records.append({
                    "tank_code": tank_code,
                    "stock_date": stock_date,
                    "event_type": "HARVEST",
                    "event_date": hvt_date,
                    "pl_stage": hvt_stage or 15,
                    "occurrence_no": occ_idx,
                    "buyer": clean_b,
                    "do_number": do_no,
                    "external_buyer": ext_buyer
                })

            if flsh_qty and flsh_qty > 0 and flsh_date:
                flushed_total_k += flsh_qty
                events.append({
                    "tank_code": tank_code,
                    "stock_date": stock_date,
                    "event_type": "FLUSH",
                    "event_date": flsh_date,
                    "pl_stage": flsh_stage or 12,
                    "qty_k": flsh_qty,
                    "occurrence_no": occ_idx,
                    "flush_type": flsh_type,
                    "flush_reason": flsh_reason,
                    "lot_no": lot_no,
                    "source_sheet": "Sheet1",
                    "source_row": r_no
                })

        if has_culture:
            final_status = "CULTURE"
        elif harvested_total_k > 0 and flushed_total_k > 0:
            final_status = "PARTIAL"
        elif harvested_total_k > 0:
            final_status = "HARVESTED"
        elif flushed_total_k > 0:
            final_status = "FLUSHED"
        else:
            final_status = "CULTURE"

        # Derived SR % (Guarded against >9999.99 numeric overflow from Excel typos)
        sr_pct = None
        sr_incl_flush_pct = None
        if nauplii_stocked_k and nauplii_stocked_k > 0:
            calc_sr = round((harvested_total_k / nauplii_stocked_k) * 100.0, 2)
            calc_sr_incl = round(((harvested_total_k + flushed_total_k) / nauplii_stocked_k) * 100.0, 2)
            if calc_sr > 9999.99:
                sr_pct = 9999.99
                flags.append("SR_OVERFLOW")
            else:
                sr_pct = calc_sr
                if sr_pct > 100.0:
                    flags.append("SR_GT_100")

            if calc_sr_incl > 9999.99:
                sr_incl_flush_pct = 9999.99
            else:
                sr_incl_flush_pct = calc_sr_incl

        avg_reported_sr = round(sum(reported_sr_list) / len(reported_sr_list), 2) if reported_sr_list else None
        if avg_reported_sr is not None and avg_reported_sr > 9999.99:
            avg_reported_sr = 9999.99
            flags.append("SR_OVERFLOW")

        if sr_pct is not None and avg_reported_sr is not None:
            if abs(sr_pct - avg_reported_sr) > 1.0:
                flags.append("SR_MISMATCH")

        runs.append({
            "tank_code": tank_code,
            "stock_date": stock_date,
            "species": species,
            "source_code": source_code,
            "source_raw": raw_source,
            "nauplii_stocked_k": nauplii_stocked_k,
            "status": final_status,
            "first_harvest_date": min(harvest_dates) if harvest_dates else None,
            "last_harvest_date": max(harvest_dates) if harvest_dates else None,
            "harvested_total_k": round(harvested_total_k, 2),
            "flushed_total_k": round(flushed_total_k, 2),
            "sr_pct": sr_pct,
            "sr_incl_flush_pct": sr_incl_flush_pct,
            "sr_reported_pct": avg_reported_sr,
            "flags": flags,
            "is_stale": False
        })

    return runs, events, commercial_records, import_logs

