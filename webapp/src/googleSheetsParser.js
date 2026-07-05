// Client-side Google Sheets CSV parser

// Custom CSV Parser that handles double quotes and commas within cells
export function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  return lines;
}

export function parseGoogleSheetsData(sheetsData) {
  // Parse DC หมวด A-D
  const rawPlanRows = parseCSV(sheetsData["DC หมวด A-D"] || "");
  if (rawPlanRows.length < 40) {
    throw new Error("Invalid 'DC หมวด A-D' sheet structure. Check if published.");
  }

  const getCellFloat = (rowIdx, colIdx, defaultValue = 0) => {
    const row = rawPlanRows[rowIdx];
    if (!row) return defaultValue;
    const val = parseFloat(row[colIdx]);
    return isNaN(val) ? defaultValue : val;
  };

  const getCellInt = (rowIdx, colIdx, defaultValue = 0) => {
    const row = rawPlanRows[rowIdx];
    if (!row) return defaultValue;
    const val = parseInt(row[colIdx]);
    return isNaN(val) ? defaultValue : val;
  };

  // 1. Project Info (Row 3, 0-indexed)
  const project_info = {
    total_rooms: getCellInt(3, 3, 0),
    avg_room_area: getCellFloat(3, 4, 0.0),
    male_pct: getCellFloat(3, 5, 0.5),
    male_wage: getCellFloat(3, 6, 350.0),
    male_ot: getCellFloat(3, 7, 65.625),
    female_pct: getCellFloat(3, 8, 0.5),
    female_wage: getCellFloat(3, 9, 300.0),
    female_ot: getCellFloat(3, 10, 56.25),
    ot_hours: getCellFloat(3, 11, 2.0),
    days_per_month: getCellInt(3, 12, 26)
  };

  // 2. Plan Months (Cols 3 to 22)
  const plan_months = [];
  const month_names = [
    "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26",
    "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26", "Dec 26", "Jan 27",
    "Feb 27", "Mar 27", "Apr 27", "May 27", "Jun 27", "Jul 27", "Aug 27", "Sep 27"
  ];

  for (let colIdx = 3; colIdx <= 22; colIdx++) {
    const mIdx = colIdx - 3;
    const mName = month_names[mIdx] || `Col ${colIdx}`;
    const rawMNum = rawPlanRows[5]?.[colIdx];
    const mNum = rawMNum && rawMNum.trim() !== "" ? parseInt(rawMNum) : null;

    const categories = {
      A: {
        workers: getCellFloat(8, colIdx),
        cum_workers: getCellFloat(9, colIdx),
        cum_value: getCellFloat(10, colIdx),
        productivity: getCellFloat(11, colIdx)
      },
      B: {
        workers: getCellFloat(13, colIdx),
        cum_workers: getCellFloat(14, colIdx),
        cum_value: getCellFloat(15, colIdx),
        productivity: getCellFloat(16, colIdx)
      },
      C: {
        workers: getCellFloat(18, colIdx),
        cum_workers: getCellFloat(19, colIdx),
        cum_value: getCellFloat(20, colIdx),
        productivity: getCellFloat(21, colIdx)
      },
      D: {
        workers: getCellFloat(23, colIdx),
        cum_workers: getCellFloat(24, colIdx),
        cum_value: getCellFloat(25, colIdx),
        productivity: getCellFloat(26, colIdx)
      }
    };

    const totals = {
      male_workers: getCellFloat(28, colIdx),
      female_workers: getCellFloat(29, colIdx),
      total_workers: getCellFloat(30, colIdx),
      wage_cost: getCellFloat(31, colIdx),
      ot_cost: getCellFloat(32, colIdx),
      total_cost: getCellFloat(33, colIdx),
      cum_cost: getCellFloat(34, colIdx),
      productivity: getCellFloat(35, colIdx)
    };

    const actual = {
      period_1_15: getCellFloat(37, colIdx),
      period_16_31: getCellFloat(38, colIdx),
      total_cost: getCellFloat(39, colIdx)
    };

    plan_months.append ? plan_months.append : plan_months.push({
      month_num: isNaN(mNum) ? null : mNum,
      month_name: mName,
      categories,
      totals,
      actual
    });
  }

  // 3. Parse Manpower Backup from 'Backup'
  const rawBackupRows = parseCSV(sheetsData["Backup"] || "");
  const manpower_backup = [];
  const backup_month_names = [
    "Jun 26", "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26", "Dec 26", "Jan 27",
    "Feb 27", "Mar 27", "Apr 27", "May 27", "Jun 27", "Jul 27", "Aug 27", "Sep 27"
  ];

  let backupIdCounter = 1;

  for (let idx = 6; idx < rawBackupRows.length; idx++) {
    const row = rawBackupRows[idx];
    if (!row) continue;
    const col0 = row[0];
    const col1 = row[1];

    if (col0 && col0.trim() !== "" && !isNaN(parseInt(col0.trim())) && col1 && col1.trim() !== "") {
      const pos_id = backupIdCounter++;
      const pos_name = col1.trim();

      const counts = {};
      for (let c = 2; c <= 17; c++) {
        const mIdx = c - 2;
        const mLabel = backup_month_names[mIdx] || `M${mIdx + 1}`;
        const val = parseFloat(row[c]);
        counts[mLabel] = isNaN(val) ? 0.0 : val;
      }

      const notes = row[18] ? row[18].trim() : "";
      const total_val = parseFloat(row[19]);

      manpower_backup.push({
        id: pos_id,
        position: pos_name,
        counts,
        notes,
        total: isNaN(total_val) ? 0.0 : total_val
      });
    }
  }

  // 4. Parse Monthly Actuals
  const monthly_actuals = {};
  const monthly_sheets = ["Feb26", "Mar26", "Apr26", "May26", "Jun26", "Jul26"];

  for (const m_sheet of monthly_sheets) {
    const sheetCsv = sheetsData[m_sheet] || "";
    const rawSheetRows = parseCSV(sheetCsv);
    const actual_rows = [];

    let current_main_cat = "";
    let current_main_desc = "";

    for (let idx = 5; idx < rawSheetRows.length; idx++) {
      const row = rawSheetRows[idx];
      if (!row) continue;

      const code_col = row[3];
      const desc_col = row[4];
      const cat_col = row[1];
      const cat_desc_col = row[2];

      if (cat_col && cat_col.trim() !== "") {
        current_main_cat = cat_col.trim();
      }
      if (cat_desc_col && cat_desc_col.trim() !== "") {
        current_main_desc = cat_desc_col.trim();
      }

      if (!desc_col || desc_col.trim() === "") continue;

      let code = "";
      let desc = desc_col.trim();

      if (code_col && code_col.trim() !== "") {
        code = code_col.trim();
      } else {
        if (desc.includes(" - ")) {
          const parts = desc.split(" - ", 2);
          const possible_code = parts[0].trim();
          if (["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].some(x => possible_code.startsWith(x))) {
            code = possible_code;
            desc = parts[1].trim();
          }
        }
      }

      if (!code) continue;

      const zones = {};
      const zone_keys = ["A", "B", "C", "D", "E", "LA", "Central"];
      for (let zIdx = 0; zIdx < zone_keys.length; zIdx++) {
        const colNum = 5 + zIdx;
        const val = parseFloat(row[colNum]);
        zones[zone_keys[zIdx]] = isNaN(val) ? 0.0 : val;
      }

      const total_people = parseFloat(row[12]);
      const percentage = parseFloat(row[13]);

      actual_rows.push({
        code,
        description: desc,
        category: current_main_cat,
        category_desc: current_main_desc,
        zones,
        total_people: isNaN(total_people) ? 0.0 : total_people,
        percentage: isNaN(percentage) ? 0.0 : percentage
      });
    }

    monthly_actuals[m_sheet] = actual_rows;
  }

  return {
    project_info,
    plan_months,
    manpower_backup,
    monthly_actuals
  };
}
