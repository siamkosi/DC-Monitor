import pandas as pd
import json
import os

excel_path = r"d:\Sandbox\DC\LR9 ตารางควบคุม DC หมวด A-D.xlsx"
output_dir = r"d:\Sandbox\DC\webapp\src"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "data.json")

print("Parsing Excel file:", excel_path)
xls = pd.ExcelFile(excel_path)

# --- 1. Parse Project Info and Plan from 'DC หมวด A-D' ---
sheet_plan = pd.read_excel(excel_path, sheet_name="DC หมวด A-D", header=None)

# Project planning basic parameters (Row 2 is header, Row 3 is value)
project_info = {
    "total_rooms": int(sheet_plan.iloc[3, 3]) if pd.notna(sheet_plan.iloc[3, 3]) else 0,
    "avg_room_area": float(sheet_plan.iloc[3, 4]) if pd.notna(sheet_plan.iloc[3, 4]) else 0.0,
    "male_pct": float(sheet_plan.iloc[3, 5]) if pd.notna(sheet_plan.iloc[3, 5]) else 0.5,
    "male_wage": float(sheet_plan.iloc[3, 6]) if pd.notna(sheet_plan.iloc[3, 6]) else 350.0,
    "male_ot": float(sheet_plan.iloc[3, 7]) if pd.notna(sheet_plan.iloc[3, 7]) else 65.625,
    "female_pct": float(sheet_plan.iloc[3, 8]) if pd.notna(sheet_plan.iloc[3, 8]) else 0.5,
    "female_wage": float(sheet_plan.iloc[3, 9]) if pd.notna(sheet_plan.iloc[3, 9]) else 300.0,
    "female_ot": float(sheet_plan.iloc[3, 10]) if pd.notna(sheet_plan.iloc[3, 10]) else 56.25,
    "ot_hours": float(sheet_plan.iloc[3, 11]) if pd.notna(sheet_plan.iloc[3, 11]) else 2.0,
    "days_per_month": int(sheet_plan.iloc[3, 12]) if pd.notna(sheet_plan.iloc[3, 12]) else 26
}

# The columns are from Column index 3 to 22 (20 months in total)
months_data = []
month_names = [
    "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", # Prep Months
    "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26", "Dec 26", "Jan 27", # Contract M1-M7
    "Feb 27", "Mar 27", "Apr 27", "May 27", "Jun 27", "Jul 27", "Aug 27", "Sep 27" # Contract M8-M15
]

for col_idx in range(3, 23):
    m_idx = col_idx - 3
    m_name = month_names[m_idx] if m_idx < len(month_names) else f"Col {col_idx}"
    raw_m_num = sheet_plan.iloc[5, col_idx]
    m_num = int(raw_m_num) if pd.notna(raw_m_num) else None
    
    def get_val(r, c, default=0.0):
        val = sheet_plan.iloc[r, c]
        return float(val) if pd.notna(val) else default
        
    categories = {
        "A": {
            "workers": get_val(8, col_idx),
            "cum_workers": get_val(9, col_idx),
            "cum_value": get_val(10, col_idx),
            "productivity": get_val(11, col_idx)
        },
        "B": {
            "workers": get_val(13, col_idx),
            "cum_workers": get_val(14, col_idx),
            "cum_value": get_val(15, col_idx),
            "productivity": get_val(16, col_idx)
        },
        "C": {
            "workers": get_val(18, col_idx),
            "cum_workers": get_val(19, col_idx),
            "cum_value": get_val(20, col_idx),
            "productivity": get_val(21, col_idx)
        },
        "D": {
            "workers": get_val(23, col_idx),
            "cum_workers": get_val(24, col_idx),
            "cum_value": get_val(25, col_idx),
            "productivity": get_val(26, col_idx)
        }
    }
    
    # Read totals
    totals = {
        "male_workers": get_val(28, col_idx),
        "female_workers": get_val(29, col_idx),
        "total_workers": get_val(30, col_idx),
        "wage_cost": get_val(31, col_idx),
        "ot_cost": get_val(32, col_idx),
        "total_cost": get_val(33, col_idx),
        "cum_cost": get_val(34, col_idx),
        "productivity": get_val(35, col_idx)
    }
    
    actual = {
        "period_1_15": get_val(37, col_idx),
        "period_16_31": get_val(38, col_idx),
        "total_cost": get_val(39, col_idx)
    }
    
    months_data.append({
        "month_num": m_num,
        "month_name": m_name,
        "categories": categories,
        "totals": totals,
        "actual": actual
    })

# --- 2. Parse Manpower Backup from 'Backup' ---
sheet_backup = pd.read_excel(excel_path, sheet_name="Backup", header=None)
manpower_backup = []

# M1 to M16 correspond to Jun 26 to Sep 27
backup_month_names = [
    "Jun 26", "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26", "Dec 26", "Jan 27",
    "Feb 27", "Mar 27", "Apr 27", "May 27", "Jun 27", "Jul 27", "Aug 27", "Sep 27"
]

backup_id_counter = 1

# Data starts from Row 6 (0-indexed 6 is row index 6)
for idx in range(6, len(sheet_backup)):
    row = sheet_backup.iloc[idx]
    col0 = row[0]
    col1 = row[1]
    
    if pd.notna(col0) and str(col0).strip().isdigit() and pd.notna(col1):
        pos_id = backup_id_counter
        backup_id_counter += 1
        pos_name = str(col1).strip()
        
        counts = {}
        for c in range(2, 18):
            m_idx = c - 2
            m_label = backup_month_names[m_idx] if m_idx < len(backup_month_names) else f"M{m_idx+1}"
            val = row[c]
            counts[m_label] = float(val) if pd.notna(val) else 0.0
            
        notes = str(row[18]).strip() if pd.notna(row[18]) else ""
        total_val = float(row[19]) if pd.notna(row[19]) else 0.0
        
        manpower_backup.append({
            "id": pos_id,
            "position": pos_name,
            "counts": counts,
            "notes": notes,
            "total": total_val
        })

# --- 3. Parse Monthly Actuals ---
monthly_actuals = {}
monthly_sheets = ["Feb26", "Mar26", "Apr26", "May26", "Jun26", "Jul26"]

for m_sheet in monthly_sheets:
    try:
        df_sheet = pd.read_excel(excel_path, sheet_name=m_sheet, header=None)
        actual_rows = []
        current_main_cat = ""
        current_main_desc = ""
        
        for idx in range(5, len(df_sheet)):
            row = df_sheet.iloc[idx]
            
            code_col = row[3]
            desc_col = row[4]
            cat_col = row[1]
            cat_desc_col = row[2]
            
            if pd.notna(cat_col):
                current_main_cat = str(cat_col).strip()
            if pd.notna(cat_desc_col):
                current_main_desc = str(cat_desc_col).strip()
                
            if pd.isna(desc_col):
                continue
                
            code = ""
            desc = str(desc_col).strip()
            
            if pd.notna(code_col):
                code = str(code_col).strip()
            else:
                if " - " in desc:
                    parts = desc.split(" - ", 1)
                    possible_code = parts[0].strip()
                    if any(possible_code.startswith(x) for x in ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]):
                        code = possible_code
                        desc = parts[1].strip()
            
            if not code:
                continue
                
            zones = {}
            zone_keys = ["A", "B", "C", "D", "E", "LA", "Central"]
            for z_idx, z_key in enumerate(zone_keys):
                col_num = 5 + z_idx
                val = row[col_num]
                zones[z_key] = float(val) if pd.notna(val) else 0.0
                
            total_people = float(row[12]) if pd.notna(row[12]) else 0.0
            percentage = float(row[13]) if pd.notna(row[13]) else 0.0
            
            actual_rows.append({
                "code": code,
                "description": desc,
                "category": current_main_cat,
                "category_desc": current_main_desc,
                "zones": zones,
                "total_people": total_people,
                "percentage": percentage
            })
            
        monthly_actuals[m_sheet] = actual_rows
    except Exception as e:
        print(f"Error parsing sheet {m_sheet}: {e}")

# --- 4. Export to JSON ---
output_data = {
    "project_info": project_info,
    "plan_months": months_data,
    "manpower_backup": manpower_backup,
    "monthly_actuals": monthly_actuals
}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)
    
print("Successfully generated data.json with unique IDs.")
