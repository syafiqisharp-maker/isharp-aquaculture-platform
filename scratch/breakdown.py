import json

with open(r'c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\comparison_result.json', 'r', encoding='utf-8') as f:
    res = json.load(f)

excel_new = {x['staff_no']: x for x in res['new_in_excel']}
db_missing = {x['staff_no']: x for x in res['missing_from_excel']}

padded_matches = []
pure_new_in_excel = []
pure_missing_in_db = []

for s_no, x in excel_new.items():
    # check if s_no zero-padded exists in db_missing
    padded_3 = s_no.zfill(3)
    padded_4 = s_no.zfill(4)
    if padded_4 in db_missing:
        padded_matches.append({'excel_no': s_no, 'db_no': padded_4, 'excel': x, 'db': db_missing[padded_4]})
    elif padded_3 in db_missing:
        padded_matches.append({'excel_no': s_no, 'db_no': padded_3, 'excel': x, 'db': db_missing[padded_3]})
    else:
        pure_new_in_excel.append(x)

matched_db_nos = {m['db_no'] for m in padded_matches}
pure_missing_in_db = [x for s_no, x in db_missing.items() if s_no not in matched_db_nos]

out = {
    'padded_matches_count': len(padded_matches),
    'padded_matches': padded_matches,
    'pure_new_in_excel_count': len(pure_new_in_excel),
    'pure_new_in_excel': pure_new_in_excel,
    'pure_missing_in_db_count': len(pure_missing_in_db),
    'pure_missing_in_db': pure_missing_in_db
}

with open(r'c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\detailed_diff.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"Padded ID matches (same person, zero-padded in DB): {len(padded_matches)}")
print(f"Actual Brand NEW in Excel (not in DB at all): {len(pure_new_in_excel)}")
print(f"Actual REMOVED/NOT in Excel (in DB but not in new list): {len(pure_missing_in_db)}")
