import os
import sys
import time
import json
import math
import datetime
import urllib.request
import openpyxl
from collections import defaultdict

print("====================================================================")
print("  iSHARP PRECISION AQUACULTURE: WATER QUALITY vs HARVEST PREDICTION ")
print("  Blue Archipelago Berhad — Setiu Shrimp Farm (2024 - 2026)         ")
print("====================================================================")

# 1. Fetch Cycles & Harvest from Supabase
SUPABASE_URL = "https://keappoukeagyzpoxkrru.supabase.co"
SUPABASE_KEY = "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def fetch_all_supabase(endpoint):
    records = []
    limit = 500
    offset = 0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}&limit={limit}&offset={offset}"
        req = urllib.request.Request(url, headers=HEADERS)
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=15) as r:
                    batch = json.loads(r.read())
                    break
            except Exception as e:
                time.sleep(1)
                if attempt == 4:
                    print(f"Error fetching {endpoint}: {e}")
                    batch = []
        if not batch: break
        records.extend(batch)
        if len(batch) < limit: break
        offset += len(batch)
    return records

print("\n[1/4] Fetching cycles & harvest from Supabase...")
cycles_raw = fetch_all_supabase("view_growout_pond_cycles?select=pond_index,pond,modl,area,crop_no,cycle_no,pond_status,final_status,disease_status,stck_date,stck_species,stck_pcs,stck_allow,stck_total,date_close")
print(f"  -> {len(cycles_raw)} cycles in view_growout_pond_cycles")
cycles_map = {c["pond_index"]: c for c in cycles_raw if c.get("pond_index")}

# Group cycles by pond to map date to cycle
pond_cycles = defaultdict(list)
for c in cycles_raw:
    p = c.get("pond")
    if p:
        pond_cycles[p].append(c)

for p in pond_cycles:
    pond_cycles[p].sort(key=lambda x: str(x.get("stck_date") or x.get("date_cycle") or ""))

harvest_raw = fetch_all_supabase("pond_harvest_daily?harv_date=gte.2024-01-01&select=pond_index,harv_date,harv_status,harv_weight,harv_abw")
print(f"  -> {len(harvest_raw)} harvest daily records in 2024-2026")

harvest_by_pond = defaultdict(lambda: {"total_kg": 0.0, "total_pcs": 0.0, "dates": [], "abws": [], "weights": []})
for r in harvest_raw:
    p = r.get("pond_index")
    if not p: continue
    w = float(r.get("harv_weight") or 0)
    abw = float(r.get("harv_abw") or 0)
    dt = r.get("harv_date")
    harvest_by_pond[p]["total_kg"] += w
    if abw > 0:
        pcs = (w * 1000.0) / abw
        harvest_by_pond[p]["total_pcs"] += pcs
        harvest_by_pond[p]["abws"].append(abw)
        harvest_by_pond[p]["weights"].append(w)
    if dt:
        harvest_by_pond[p]["dates"].append(dt)

# Compute Harvest Outcomes (SR, DOC, ADG, Final ABW) per cycle
cycle_outcomes = {}
for p_idx, h in harvest_by_pond.items():
    if p_idx not in cycles_map:
        continue
    c = cycles_map[p_idx]
    stck_tot = float(c.get("stck_total") or c.get("stck_pcs") or 0)
    stck_dt_str = c.get("stck_date")
    if stck_tot <= 0 or not stck_dt_str or not h["dates"]:
        continue
    
    stck_dt = datetime.datetime.strptime(stck_dt_str[:10], "%Y-%m-%d").date()
    harv_dt = datetime.datetime.strptime(max(h["dates"])[:10], "%Y-%m-%d").date()
    doc = (harv_dt - stck_dt).days
    if doc < 30 or doc > 180: # Filter unrealistic DOC outliers
        continue
    
    sr = (h["total_pcs"] / stck_tot) * 100.0
    if sr < 1.0 or sr > 120.0: # Filter extreme errors
        continue
    
    # Weighted ABW
    if sum(h["weights"]) > 0:
        weighted_abw = sum(w * a for w, a in zip(h["weights"], h["abws"])) / sum(h["weights"])
    else:
        weighted_abw = h["abws"][-1] if h["abws"] else 0.0
    
    if weighted_abw <= 0:
        continue
    
    adg = weighted_abw / doc
    
    cycle_outcomes[p_idx] = {
        "pond_index": p_idx,
        "pond": c.get("pond"),
        "species": c.get("stck_species") or "UNKNOWN",
        "disease": c.get("disease_status") or "NORMAL",
        "stck_date": stck_dt_str,
        "harv_date": str(harv_dt),
        "stck_tot": stck_tot,
        "total_kg": h["total_kg"],
        "doc": doc,
        "sr": sr,
        "abw": weighted_abw,
        "adg": adg
    }

print(f"  -> Successfully computed valid harvest outcomes for {len(cycle_outcomes)} pond cycles (2024-2026).")

# 2. Extract Water Quality records from Master Excel DB COMBINE
EXCEL_PATH = r"C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Water Quality DB\DATABASE COMBINE MONITORING 2024 - 2026 new.xlsx"
print(f"\n[2/4] Reading Water Quality records from {os.path.basename(EXCEL_PATH)}...")

wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
sheet = wb["DB COMBINE"]
header = next(sheet.iter_rows(values_only=True))
col_map = {name: i for i, name in enumerate(header) if name}

def parse_flt(val):
    if val is None: return None
    if isinstance(val, (int, float)): return float(val)
    s = str(val).strip().replace(",", "")
    if not s or s in ("-", "ND", "N/A", "nil", "NA", "None"): return None
    clean = "".join(ch for ch in s if ch.isdigit() or ch == ".")
    try:
        return float(clean) if clean else None
    except:
        return None

# Map each WQ record to pond_index using cycle boundaries
cycle_wq = defaultdict(lambda: defaultdict(list))
wq_row_count = 0

for row in sheet.iter_rows(values_only=True):
    wq_row_count += 1
    # Year check
    yr = row[col_map.get("Year", 0)]
    try:
        yr = int(yr)
    except:
        continue
    if yr not in (2024, 2025, 2026):
        continue
    
    p_name = row[col_map.get("Pond", 12)]
    d_val = row[col_map.get("Date", 4)]
    if not p_name or not d_val:
        continue
    
    p_name = str(p_name).strip()
    if isinstance(d_val, datetime.datetime):
        log_date = d_val.date()
    elif isinstance(d_val, datetime.date):
        log_date = d_val
    else:
        try:
            log_date = datetime.datetime.strptime(str(d_val)[:10], "%Y-%m-%d").date()
        except:
            continue
    
    # Resolve pond_index
    target_p_idx = None
    if p_name in pond_cycles:
        for c in pond_cycles[p_name]:
            s_dt_str = c.get("stck_date") or c.get("date_cycle")
            c_dt_str = c.get("date_close")
            if not s_dt_str: continue
            try:
                s_dt = datetime.datetime.strptime(str(s_dt_str)[:10], "%Y-%m-%d").date()
            except:
                continue
            c_dt = None
            if c_dt_str:
                try:
                    c_dt = datetime.datetime.strptime(str(c_dt_str)[:10], "%Y-%m-%d").date()
                except:
                    pass
            
            if s_dt <= log_date:
                if c_dt and log_date <= c_dt:
                    target_p_idx = c.get("pond_index")
                    break
                elif not c_dt:
                    target_p_idx = c.get("pond_index")
                    break

    if not target_p_idx or target_p_idx not in cycle_outcomes:
        continue
    
    # Extract the requested parameters: Ammonia, Nitrite, Salinity, Calcium, Magnesium, Turbidity
    # Also extract Alkalinity, DO AM, pH AM for comparison
    params = {
        "ammonia": parse_flt(row[col_map.get("Ammonia", 19)]),
        "nitrite": parse_flt(row[col_map.get("Nitrite", 20)]),
        "salinity": parse_flt(row[col_map.get("Salinity (ppt)", 14)]),
        "calcium": parse_flt(row[col_map.get("Calcium", 31)]),
        "magnesium": parse_flt(row[col_map.get("Magnesium", 32)]),
        "turbidity": parse_flt(row[col_map.get("Turbidity", 34)]),
        "alkalinity": parse_flt(row[col_map.get("Alkalinity", 18)]),
        "do_am": parse_flt(row[col_map.get("DO AM (mg/L)", 23)]),
        "ph_am": parse_flt(row[col_map.get("pH (AM)", 15)])
    }
    
    for param_name, val in params.items():
        if val is not None and not math.isnan(val):
            cycle_wq[target_p_idx][param_name].append(val)

wb.close()
print(f"  -> Matched water quality series for {len(cycle_wq)} completed harvest cycles.")

# 3. Combine Data and Compute Cycle Aggregates (Mean, Max, StdDev, Threshold Exceedances)
dataset = []
for p_idx, wq_dict in cycle_wq.items():
    outcome = cycle_outcomes[p_idx]
    
    # We require at least some measurements for core parameters
    if len(wq_dict.get("salinity", [])) < 3:
        continue
    
    row_data = {
        "pond_index": p_idx,
        "pond": outcome["pond"],
        "species": outcome["species"],
        "disease": outcome["disease"],
        "doc": outcome["doc"],
        "sr": outcome["sr"],
        "abw": outcome["abw"],
        "adg": outcome["adg"]
    }
    
    for param in ["ammonia", "nitrite", "salinity", "calcium", "magnesium", "turbidity", "alkalinity", "do_am", "ph_am"]:
        vals = wq_dict.get(param, [])
        if vals:
            row_data[f"{param}_mean"] = sum(vals) / len(vals)
            row_data[f"{param}_max"] = max(vals)
            row_data[f"{param}_min"] = min(vals)
            if len(vals) > 1:
                variance = sum((x - row_data[f"{param}_mean"])**2 for x in vals) / (len(vals) - 1)
                row_data[f"{param}_std"] = math.sqrt(variance)
            else:
                row_data[f"{param}_std"] = 0.0
            row_data[f"{param}_count"] = len(vals)
        else:
            row_data[f"{param}_mean"] = None
            row_data[f"{param}_max"] = None
            row_data[f"{param}_min"] = None
            row_data[f"{param}_std"] = None
            row_data[f"{param}_count"] = 0
            
    # Calculate Ca:Mg ratio and hardness
    if row_data["calcium_mean"] and row_data["magnesium_mean"] and row_data["magnesium_mean"] > 0:
        row_data["ca_mg_ratio"] = row_data["calcium_mean"] / row_data["magnesium_mean"]
    else:
        row_data["ca_mg_ratio"] = None
        
    dataset.append(row_data)

print(f"\n[3/4] Ready Dataset: {len(dataset)} cycles with paired WQ and Harvest data.")

# 4. Statistical Correlation Engine
def pearson_r(x, y):
    pairs = [(a, b) for a, b in zip(x, y) if a is not None and b is not None and not math.isnan(a) and not math.isnan(b)]
    n = len(pairs)
    if n < 5: return None, 0
    mean_x = sum(p[0] for p in pairs) / n
    mean_y = sum(p[1] for p in pairs) / n
    num = sum((p[0] - mean_x) * (p[1] - mean_y) for p in pairs)
    den_x = math.sqrt(sum((p[0] - mean_x)**2 for p in pairs))
    den_y = math.sqrt(sum((p[1] - mean_y)**2 for p in pairs))
    if den_x == 0 or den_y == 0: return 0.0, n
    r = num / (den_x * den_y)
    return r, n

def spearman_r(x, y):
    pairs = [(a, b) for a, b in zip(x, y) if a is not None and b is not None and not math.isnan(a) and not math.isnan(b)]
    n = len(pairs)
    if n < 5: return None, 0
    
    def get_ranks(vals):
        sorted_indices = sorted(range(len(vals)), key=lambda k: vals[k])
        ranks = [0] * len(vals)
        i = 0
        while i < len(vals):
            j = i
            while j < len(vals) - 1 and vals[sorted_indices[j]] == vals[sorted_indices[j+1]]:
                j += 1
            rank = (i + j + 2) / 2.0
            for k in range(i, j + 1):
                ranks[sorted_indices[k]] = rank
            i = j + 1
        return ranks

    rank_x = get_ranks([p[0] for p in pairs])
    rank_y = get_ranks([p[1] for p in pairs])
    return pearson_r(rank_x, rank_y)

# Analyze correlations
sr_vals = [d["sr"] for d in dataset]
adg_vals = [d["adg"] for d in dataset]

features = [
    ("ammonia_mean", "Ammonia (Mean ppm)"),
    ("ammonia_max", "Ammonia (Max Peak ppm)"),
    ("nitrite_mean", "Nitrite (Mean ppm)"),
    ("nitrite_max", "Nitrite (Max Peak ppm)"),
    ("salinity_mean", "Salinity (Mean ppt)"),
    ("salinity_std", "Salinity Fluctuation (StdDev)"),
    ("calcium_mean", "Calcium (Mean ppm)"),
    ("magnesium_mean", "Magnesium (Mean ppm)"),
    ("ca_mg_ratio", "Ca : Mg Ratio"),
    ("turbidity_mean", "Turbidity (Mean NTU)"),
    ("alkalinity_mean", "Alkalinity (Mean ppm)"),
    ("do_am_mean", "DO AM (Mean ppm)"),
    ("ph_am_mean", "pH AM (Mean)")
]

print("\n" + "="*85)
print("  CORRELATION MATRIX: WATER QUALITY vs HARVEST OUTCOMES (N = %d POND CYCLES)" % len(dataset))
print("="*85)
print(f"{'Feature Parameter':<30} | {'Pearson r (SR)':<15} | {'Spearman rho (SR)':<18} | {'Pearson r (ADG)':<16} | {'Spearman rho (ADG)':<18}")
print("-" * 105)

results_summary = []
for f_key, f_label in features:
    f_vals = [d[f_key] for d in dataset]
    p_sr, n_sr = pearson_r(f_vals, sr_vals)
    s_sr, _ = spearman_r(f_vals, sr_vals)
    p_adg, n_adg = pearson_r(f_vals, adg_vals)
    s_adg, _ = spearman_r(f_vals, adg_vals)
    
    p_sr_str = f"{p_sr:+.4f}" if p_sr is not None else "N/A"
    s_sr_str = f"{s_sr:+.4f}" if s_sr is not None else "N/A"
    p_adg_str = f"{p_adg:+.4f}" if p_adg is not None else "N/A"
    s_adg_str = f"{s_adg:+.4f}" if s_adg is not None else "N/A"
    
    print(f"{f_label:<30} | {p_sr_str:<15} | {s_sr_str:<18} | {p_adg_str:<16} | {s_adg_str:<18}")
    results_summary.append({
        "feature": f_label,
        "r_sr": p_sr, "rho_sr": s_sr,
        "r_adg": p_adg, "rho_adg": s_adg,
        "n": n_sr
    })

# 5. Non-Linear & Threshold Analysis (Why does it look random?)
print("\n" + "="*85)
print("  THRESHOLD / QUADRANT BREAKDOWN (TOP 25% vs BOTTOM 25% PONDS)")
print("="*85)

sorted_by_sr = sorted(dataset, key=lambda x: x["sr"])
q1_sr = sorted_by_sr[:len(dataset)//4] # Worst SR
q4_sr = sorted_by_sr[3*len(dataset)//4:] # Best SR

sorted_by_adg = sorted(dataset, key=lambda x: x["adg"])
q1_adg = sorted_by_adg[:len(dataset)//4] # Worst ADG
q4_adg = sorted_by_adg[3*len(dataset)//4:] # Best ADG

def get_mean(rows, key):
    valid = [r[key] for r in rows if r.get(key) is not None]
    return sum(valid) / len(valid) if valid else 0.0

print(f"\n[SURVIVAL RATE COMPARISON]")
print(f"  • Bottom 25% Ponds (Low SR): Avg SR = {get_mean(q1_sr, 'sr'):.1f}%, Avg ADG = {get_mean(q1_sr, 'adg'):.3f} g/day")
print(f"  • Top 25% Ponds (High SR):    Avg SR = {get_mean(q4_sr, 'sr'):.1f}%, Avg ADG = {get_mean(q4_sr, 'adg'):.3f} g/day")
print(f"\n  Parameter                    | Low SR Ponds (Mean) | High SR Ponds (Mean) | Difference (%)")
print("  " + "-"*75)
for f_key, f_label in features[:8]:
    m_low = get_mean(q1_sr, f_key)
    m_high = get_mean(q4_sr, f_key)
    diff = ((m_high - m_low) / m_low * 100) if m_low != 0 else 0
    print(f"  {f_label:<28} | {m_low:19.3f} | {m_high:20.3f} | {diff:+14.1f}%")

print(f"\n[AVERAGE DAILY GAIN (ADG) COMPARISON]")
print(f"  • Bottom 25% Ponds (Slow Growth): Avg ADG = {get_mean(q1_adg, 'adg'):.3f} g/day, Avg DOC = {get_mean(q1_adg, 'doc'):.0f} d")
print(f"  • Top 25% Ponds (Fast Growth):    Avg ADG = {get_mean(q4_adg, 'adg'):.3f} g/day, Avg DOC = {get_mean(q4_adg, 'doc'):.0f} d")
print(f"\n  Parameter                    | Low ADG Ponds (Mean)| High ADG Ponds(Mean) | Difference (%)")
print("  " + "-"*75)
for f_key, f_label in features[:8]:
    m_low = get_mean(q1_adg, f_key)
    m_high = get_mean(q4_adg, f_key)
    diff = ((m_high - m_low) / m_low * 100) if m_low != 0 else 0
    print(f"  {f_label:<28} | {m_low:19.3f} | {m_high:20.3f} | {diff:+14.1f}%")

# Save summary json for records
output_json = {
    "total_cycles_analyzed": len(dataset),
    "correlations": results_summary,
    "low_sr_vs_high_sr": {
        "low_sr_avg": get_mean(q1_sr, 'sr'),
        "high_sr_avg": get_mean(q4_sr, 'sr')
    }
}
with open(r"C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\wq_analysis_results.json", "w") as f:
    json.dump(output_json, f, indent=2)

print("\n[OK] Analysis completed successfully. Output saved to scratch/wq_analysis_results.json")
