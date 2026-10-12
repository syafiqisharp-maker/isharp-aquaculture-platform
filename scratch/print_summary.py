import json

with open(r'c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\comparison_result.json', 'r', encoding='utf-8') as f:
    res = json.load(f)

with open(r'c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\detailed_diff.json', 'r', encoding='utf-8') as f:
    detailed = json.load(f)

print("="*60)
print(f"1. NEW WORKERS IN HR EXCEL (Not in Supabase DB at all) [{detailed['pure_new_in_excel_count']}]")
print("="*60)
for w in detailed['pure_new_in_excel']:
    print(f"  • ID {w['staff_no']:>4}: {w['staff_name']} — [{w['staff_position']}]")

print("\n" + "="*60)
print(f"2. WORKERS IN DB BUT MISSING FROM HR EXCEL [{detailed['pure_missing_in_db_count']}]")
print("="*60)
for w in detailed['pure_missing_in_db']:
    print(f"  • ID {w['staff_no']:>4}: {w['staff_name']} — [{w['staff_position']}]")

print("\n" + "="*60)
print(f"3. ZERO-PADDING DIFFERENCES (Same person, 2-3 digits in Excel vs 4-digits in DB) [{detailed['padded_matches_count']}]")
print("="*60)
for m in detailed['padded_matches']:
    e = m['excel']
    d = m['db']
    note = []
    if e['staff_name'] != d['staff_name']:
        note.append(f"Name: '{d['staff_name']}' -> '{e['staff_name']}'")
    if e['staff_position'] != d['staff_position']:
        note.append(f"Pos: '{d['staff_position']}' -> '{e['staff_position']}'")
    notes_str = (" | " + ", ".join(note)) if note else " (Names match exactly)"
    print(f"  • Excel ID {m['excel_no']:>3} vs DB ID {m['db_no']:>4}: {e['staff_name']}{notes_str}")

print("\n" + "="*60)
print(f"4. WORKERS WITH UPDATED DETAILS (Same 4-digit ID, but Name/Title differs) [{len(res['differences'])}]")
print("="*60)
for d in res['differences']:
    diff_desc = []
    for k, v in d['diffs'].items():
        diff_desc.append(f"{k}: '{v['db']}' -> '{v['excel']}'")
    print(f"  • ID {d['staff_no']:>4}: " + " | ".join(diff_desc))
