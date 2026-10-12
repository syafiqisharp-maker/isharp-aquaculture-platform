import os
import sys
import time
import json
import math
import datetime
import urllib.request
from collections import defaultdict

print("====================================================================")
print("  iSHARP PRECISION AQUACULTURE: WATER QUALITY vs HARVEST PREDICTION ")
print("  Direct Supabase Extraction & Rigorous Statistical Modeling        ")
print("====================================================================")

SUPABASE_URL = "https://keappoukeagyzpoxkrru.supabase.co"
SUPABASE_KEY = "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def fetch_all_supabase(endpoint, page_size=1000):
    records = []
    offset = 0
    while True:
        sep = "&" if "?" in endpoint else "?"
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}{sep}limit={page_size}&offset={offset}"
        req = urllib.request.Request(url, headers=HEADERS)
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    batch = json.loads(r.read())
                    break
            except Exception as e:
                time.sleep(1.5)
                if attempt == 4:
                    print(f"Error fetching {endpoint} at offset {offset}: {e}")
                    batch = []
        if not batch: break
        records.extend(batch)
        if len(batch) < page_size: break
        offset += len(batch)
    return records

print("\n[1/4] Fetching growout cycles, harvest, and lab water quality from Supabase Cloud...")

# 1. Fetch Cycles
cycles_raw = fetch_all_supabase("view_growout_pond_cycles?select=pond_index,pond,modl,area,cycle_no,stck_date,stck_species,stck_pcs,stck_total,date_close,disease_status,final_status")
print(f"  -> Loaded {len(cycles_raw)} cycles from view_growout_pond_cycles.")
cycles_map = {c["pond_index"]: c for c in cycles_raw if c.get("pond_index")}

# 2. Fetch Harvest 2024-2026
harvest_raw = fetch_all_supabase("pond_harvest_daily?harv_date=gte.2024-01-01&select=pond_index,harv_date,harv_status,harv_weight,harv_abw")
print(f"  -> Loaded {len(harvest_raw)} harvest daily records in 2024-2026.")

harvest_by_cycle = defaultdict(lambda: {"total_kg": 0.0, "total_pcs": 0.0, "dates": [], "abws": [], "weights": []})
for r in harvest_raw:
    p = r.get("pond_index")
    if not p: continue
    w = float(r.get("harv_weight") or 0)
    abw = float(r.get("harv_abw") or 0)
    dt = r.get("harv_date")
    harvest_by_cycle[p]["total_kg"] += w
    if abw > 0:
        pcs = (w * 1000.0) / abw
        harvest_by_cycle[p]["total_pcs"] += pcs
        harvest_by_cycle[p]["abws"].append(abw)
        harvest_by_cycle[p]["weights"].append(w)
    if dt:
        harvest_by_cycle[p]["dates"].append(dt)

# Compute Harvest Outcomes
cycle_outcomes = {}
for p_idx, h in harvest_by_cycle.items():
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
    if doc < 20 or doc > 200:
        continue
    
    sr = (h["total_pcs"] / stck_tot) * 100.0
    if sr < 1.0 or sr > 130.0:
        continue
    
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
        "modl": c.get("modl"),
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

print(f"  -> Filtered {len(cycle_outcomes)} valid completed cycles with harvest outcomes.")

# 3. Fetch Lab Water Quality from Supabase
print("\n[2/4] Fetching all 15,640 records from Supabase 'lab_water_quality'...")
wq_raw = fetch_all_supabase("lab_water_quality?select=pond_index,log_date,salinity_ppt,ammonia,nitrite,calcium,magnesium,turbidity,alkalinity", page_size=1000)
print(f"  -> Successfully loaded {len(wq_raw)} lab water quality records.")

# Group WQ measurements by cycle (pond_index)
cycle_wq = defaultdict(lambda: defaultdict(list))
for r in wq_raw:
    p_idx = r.get("pond_index")
    if not p_idx or p_idx not in cycle_outcomes:
        continue
    for param in ["salinity_ppt", "ammonia", "nitrite", "calcium", "magnesium", "turbidity", "alkalinity"]:
        v = r.get(param)
        if v is not None:
            try:
                flt = float(v)
                if not math.isnan(flt):
                    cycle_wq[p_idx][param].append(flt)
            except:
                pass

print(f"  -> Matched water quality series to {len(cycle_wq)} completed harvest cycles.")

# 4. Build Dataset
dataset = []
for p_idx, wq_dict in cycle_wq.items():
    outcome = cycle_outcomes[p_idx]
    
    # Must have at least 3 salinity samples
    if len(wq_dict.get("salinity_ppt", [])) < 3:
        continue
    
    row_data = {
        "pond_index": p_idx,
        "pond": outcome["pond"],
        "modl": outcome["modl"],
        "species": outcome["species"],
        "disease": outcome["disease"],
        "doc": outcome["doc"],
        "sr": outcome["sr"],
        "abw": outcome["abw"],
        "adg": outcome["adg"],
        "total_kg": outcome["total_kg"]
    }
    
    for param in ["ammonia", "nitrite", "salinity_ppt", "calcium", "magnesium", "turbidity", "alkalinity"]:
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
            
    # Ca:Mg ratio
    if row_data.get("calcium_mean") and row_data.get("magnesium_mean") and row_data["magnesium_mean"] > 0:
        row_data["ca_mg_ratio"] = row_data["calcium_mean"] / row_data["magnesium_mean"]
    else:
        row_data["ca_mg_ratio"] = None
        
    dataset.append(row_data)

print(f"\n[3/4] High-Quality Paired Dataset: {len(dataset)} cycles ready for statistical analysis.")

# 5. Statistical Correlation Engine
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

sr_vals = [d["sr"] for d in dataset]
adg_vals = [d["adg"] for d in dataset]

features = [
    ("ammonia_mean", "Ammonia (Mean ppm)"),
    ("ammonia_max", "Ammonia (Peak Max ppm)"),
    ("nitrite_mean", "Nitrite (Mean ppm)"),
    ("nitrite_max", "Nitrite (Peak Max ppm)"),
    ("salinity_ppt_mean", "Salinity (Mean ppt)"),
    ("salinity_ppt_std", "Salinity Swing (StdDev)"),
    ("calcium_mean", "Calcium (Mean ppm)"),
    ("magnesium_mean", "Magnesium (Mean ppm)"),
    ("ca_mg_ratio", "Ca : Mg Balance Ratio"),
    ("turbidity_mean", "Turbidity (Mean NTU)"),
    ("alkalinity_mean", "Alkalinity (Mean ppm)")
]

print("\n" + "="*95)
print("  EMPIRICAL CORRELATION MATRIX: WATER QUALITY vs HARVEST OUTCOMES (N = %d CYCLES)" % len(dataset))
print("="*95)
print(f"{'Feature Parameter':<28} | {'Pearson r (SR)':<15} | {'R2 (SR)':<8} | {'Spearman (SR)':<15} | {'Pearson (ADG)':<14} | {'Spearman (ADG)':<15}")
print("-" * 105)

results = []
for f_key, f_label in features:
    f_vals = [d[f_key] for d in dataset]
    p_sr, n_sr = pearson_r(f_vals, sr_vals)
    s_sr, _ = spearman_r(f_vals, sr_vals)
    p_adg, n_adg = pearson_r(f_vals, adg_vals)
    s_adg, _ = spearman_r(f_vals, adg_vals)
    
    r2_sr = (p_sr**2) if p_sr is not None else 0.0
    
    p_sr_str = f"{p_sr:+.4f}" if p_sr is not None else "N/A"
    r2_sr_str = f"{r2_sr:.4f}" if p_sr is not None else "N/A"
    s_sr_str = f"{s_sr:+.4f}" if s_sr is not None else "N/A"
    p_adg_str = f"{p_adg:+.4f}" if p_adg is not None else "N/A"
    s_adg_str = f"{s_adg:+.4f}" if s_adg is not None else "N/A"
    
    print(f"{f_label:<28} | {p_sr_str:<15} | {r2_sr_str:<8} | {s_sr_str:<15} | {p_adg_str:<14} | {s_adg_str:<15}")
    results.append({
        "param": f_label,
        "key": f_key,
        "r_sr": p_sr, "r2_sr": r2_sr, "rho_sr": s_sr,
        "r_adg": p_adg, "rho_adg": s_adg, "n": n_sr
    })

# 6. Top 25% vs Bottom 25% Contrast
print("\n" + "="*95)
print("  WHY IT LOOKS RANDOM: TOP 25% vs BOTTOM 25% PONDS COMPARISON")
print("="*95)

sorted_by_sr = sorted(dataset, key=lambda x: x["sr"])
q1_sr = sorted_by_sr[:len(dataset)//4] # Worst SR
q4_sr = sorted_by_sr[3*len(dataset)//4:] # Best SR

sorted_by_adg = sorted(dataset, key=lambda x: x["adg"])
q1_adg = sorted_by_adg[:len(dataset)//4] # Worst ADG
q4_adg = sorted_by_adg[3*len(dataset)//4:] # Best ADG

def get_mean(rows, key):
    valid = [r[key] for r in rows if r.get(key) is not None]
    return sum(valid) / len(valid) if valid else 0.0

print(f"\n[SURVIVAL RATE (SR) QUANTILES]")
print(f"  • Worst 25% Ponds (Crashed/Low):  Avg SR = {get_mean(q1_sr, 'sr'):.1f}%, Avg ADG = {get_mean(q1_sr, 'adg'):.3f} g/day, Avg DOC = {get_mean(q1_sr, 'doc'):.0f} d")
print(f"  • Top 25% Ponds (High Survival): Avg SR = {get_mean(q4_sr, 'sr'):.1f}%, Avg ADG = {get_mean(q4_sr, 'adg'):.3f} g/day, Avg DOC = {get_mean(q4_sr, 'doc'):.0f} d")

print(f"\n  {'Parameter':<28} | {'Worst 25% SR':<15} | {'Best 25% SR':<15} | {'Delta':<10}")
print("  " + "-"*75)
for f_key, f_label in features:
    m_low = get_mean(q1_sr, f_key)
    m_high = get_mean(q4_sr, f_key)
    diff = ((m_high - m_low) / m_low * 100) if m_low != 0 else 0
    print(f"  {f_label:<28} | {m_low:15.3f} | {m_high:15.3f} | {diff:+9.1f}%")

print(f"\n[AVERAGE DAILY GAIN (ADG) QUANTILES]")
print(f"  • Worst 25% Ponds (Slow Growth): Avg ADG = {get_mean(q1_adg, 'adg'):.3f} g/day, Avg ABW = {get_mean(q1_adg, 'abw'):.2f} g")
print(f"  • Top 25% Ponds (Fast Growth):   Avg ADG = {get_mean(q4_adg, 'adg'):.3f} g/day, Avg ABW = {get_mean(q4_adg, 'abw'):.2f} g")

print(f"\n  {'Parameter':<28} | {'Worst 25% ADG':<15} | {'Best 25% ADG':<15} | {'Delta':<10}")
print("  " + "-"*75)
for f_key, f_label in features:
    m_low = get_mean(q1_adg, f_key)
    m_high = get_mean(q4_adg, f_key)
    diff = ((m_high - m_low) / m_low * 100) if m_low != 0 else 0
    print(f"  {f_label:<28} | {m_low:15.3f} | {m_high:15.3f} | {diff:+9.1f}%")

# Save detailed JSON output
final_output = {
    "n_cycles": len(dataset),
    "features": results,
    "quantiles_sr": {
        "worst_sr": get_mean(q1_sr, "sr"),
        "best_sr": get_mean(q4_sr, "sr")
    },
    "quantiles_adg": {
        "worst_adg": get_mean(q1_adg, "adg"),
        "best_adg": get_mean(q4_adg, "adg")
    }
}
with open(r"C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\wq_analysis_results.json", "w") as f:
    json.dump(final_output, f, indent=2)

print("\n[SUCCESS] Statistical analysis concluded successfully!")
