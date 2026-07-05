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
  if (rawPlanRows.length < 25) {
    throw new Error("Invalid 'DC หมวด A-D' sheet structure. Check if published.");
  }

  // --- Dynamic Row Finder Helpers ---
  const findRowIndexWithCellMatch = (colIdx, text) => {
    for (let i = 0; i < rawPlanRows.length; i++) {
      const row = rawPlanRows[i];
      if (row && row[colIdx] && row[colIdx].trim().includes(text)) {
        return i;
      }
    }
    return -1;
  };

  const findRowByLabel = (label) => {
    for (let i = 0; i < rawPlanRows.length; i++) {
      const row = rawPlanRows[i];
      if (!row) continue;
      for (let c = 0; c < Math.min(row.length, 3); c++) {
        if (row[c] && row[c].trim().includes(label)) {
          return i;
        }
      }
    }
    return -1;
  };

  const findCategoryRowIdx = (catName, subLabel) => {
    let catRowIdx = -1;
    for (let i = 0; i < rawPlanRows.length; i++) {
      const row = rawPlanRows[i];
      if (row && row[0]) {
        const cleanVal = row[0].trim().replace(/\s+/g, '');
        if (cleanVal === `หมวด${catName}` || cleanVal === catName) {
          catRowIdx = i;
          break;
        }
      }
    }
    if (catRowIdx === -1) return -1;
    for (let i = catRowIdx; i < catRowIdx + 6 && i < rawPlanRows.length; i++) {
      const row = rawPlanRows[i];
      if (row && row[1]) {
        const cleanSub = row[1].trim();
        if (cleanSub === subLabel || cleanSub.includes(subLabel)) {
          return i;
        }
      }
    }
    return -1;
  };

  // Helper to parse float from cells with support for commas, spaces and dashes
  const getValFloat = (rowIdx, colIdx, defaultValue = 0) => {
    if (rowIdx === -1) return defaultValue;
    const row = rawPlanRows[rowIdx];
    if (!row) return defaultValue;
    const rawVal = row[colIdx];
    if (!rawVal) return defaultValue;
    const cleaned = rawVal.replace(/,/g, '').trim();
    if (cleaned === '-' || cleaned === '' || cleaned === '—' || cleaned === '-   ') return 0;
    const val = parseFloat(cleaned);
    return isNaN(val) ? defaultValue : val;
  };

  const getValInt = (rowIdx, colIdx, defaultValue = 0) => {
    if (rowIdx === -1) return defaultValue;
    const row = rawPlanRows[rowIdx];
    if (!row) return defaultValue;
    const rawVal = row[colIdx];
    if (!rawVal) return defaultValue;
    const cleaned = rawVal.replace(/,/g, '').trim();
    if (cleaned === '-' || cleaned === '' || cleaned === '—' || cleaned === '-   ') return 0;
    const val = parseInt(cleaned);
    return isNaN(val) ? defaultValue : val;
  };

  // 1. Find and Parse Project Info
  const headerRowIdx = findRowIndexWithCellMatch(3, "จำนวนห้อง");
  const infoRowIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : -1;

  const project_info = {
    total_rooms: getValInt(infoRowIdx, 3, 0),
    avg_room_area: getValFloat(infoRowIdx, 4, 0.0),
    male_pct: getValFloat(infoRowIdx, 5, 0.5),
    male_wage: getValFloat(infoRowIdx, 6, 350.0),
    male_ot: getValFloat(infoRowIdx, 7, 65.625),
    female_pct: getValFloat(infoRowIdx, 8, 0.5),
    female_wage: getValFloat(infoRowIdx, 9, 300.0),
    female_ot: getValFloat(infoRowIdx, 10, 56.25),
    ot_hours: getValFloat(infoRowIdx, 11, 2.0),
    days_per_month: getValInt(infoRowIdx, 12, 26)
  };

  // 2. Find and Parse Plan Months
  const plan_months = [];
  const month_names = [
    "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26",
    "Jul 26", "Aug 26", "Sep 26", "Oct 26", "Nov 26", "Dec 26", "Jan 27",
    "Feb 27", "Mar 27", "Apr 27", "May 27", "Jun 27", "Jul 27", "Aug 27", "Sep 27"
  ];

  // Dynamically resolve Category Row Indices
  const catRows = {
    A: {
      workers: findCategoryRowIdx("A", "จำนวนแรงงาน"),
      cum_workers: findCategoryRowIdx("A", "จำนวนแรงงานสะสม"),
      cum_value: findCategoryRowIdx("A", "มูลค่าสะสม"),
      productivity: findCategoryRowIdx("A", "Productivity")
    },
    B: {
      workers: findCategoryRowIdx("B", "จำนวนแรงงาน"),
      cum_workers: findCategoryRowIdx("B", "จำนวนแรงงานสะสม"),
      cum_value: findCategoryRowIdx("B", "มูลค่าสะสม"),
      productivity: findCategoryRowIdx("B", "Productivity")
    },
    C: {
      workers: findCategoryRowIdx("C", "จำนวนแรงงาน"),
      cum_workers: findCategoryRowIdx("C", "จำนวนแรงงานสะสม"),
      cum_value: findCategoryRowIdx("C", "มูลค่าสะสม"),
      productivity: findCategoryRowIdx("C", "Productivity")
    },
    D: {
      workers: findCategoryRowIdx("D", "จำนวนแรงงาน"),
      cum_workers: findCategoryRowIdx("D", "จำนวนแรงงานสะสม"),
      cum_value: findCategoryRowIdx("D", "มูลค่าสะสม"),
      productivity: findCategoryRowIdx("D", "Productivity")
    }
  };

  // Dynamically resolve Totals Row Indices
  const totalsRows = {
    male_workers: findRowByLabel("แรงงาน ช"),
    female_workers: findRowByLabel("แรงงาน ญ"),
    total_workers: findRowByLabel("แรงงาน (คน) / เดือน"),
    wage_cost: findRowByLabel("ค่าแรง / เดือน"),
    ot_cost: findRowByLabel("OT / เดือน"),
    total_cost: findRowByLabel("รวมค่าแรง + OT"),
    cum_cost: findRowByLabel("รวมค่าแรงสะสม")
  };

  // Find Totals Productivity (row after cum_cost)
  let totalsProductivityRowIdx = -1;
  const cumCostRowIdx = totalsRows.cum_cost;
  if (cumCostRowIdx !== -1) {
    for (let i = cumCostRowIdx + 1; i < cumCostRowIdx + 5 && i < rawPlanRows.length; i++) {
      const row = rawPlanRows[i];
      if (row && (
        (row[0] && row[0].includes("Productivity")) ||
        (row[1] && row[1].includes("Productivity")) ||
        (row[2] && row[2].includes("Productivity"))
      )) {
        totalsProductivityRowIdx = i;
        break;
      }
    }
  }
  totalsRows.productivity = totalsProductivityRowIdx;

  // Dynamically resolve Actuals Row Indices
  const actualHeaderIdx = findRowByLabel("ทำจริง");
  let actualPeriod1RowIdx = -1;
  let actualPeriod2RowIdx = -1;
  let actualTotalRowIdx = -1;
  if (actualHeaderIdx !== -1) {
    for (let i = actualHeaderIdx; i < actualHeaderIdx + 5 && i < rawPlanRows.length; i++) {
      const row = rawPlanRows[i];
      if (!row) continue;
      for (let c = 0; c < Math.min(row.length, 3); c++) {
        const val = row[c] ? row[c].trim() : "";
        if (val.includes("1 - 15")) actualPeriod1RowIdx = i;
        if (val.includes("16 - 31")) actualPeriod2RowIdx = i;
        if (val.includes("รวมค่าแรงต่อเดือน") || val.includes("ค่าแรงต่อเดือน") || val.includes("แรงงาน")) {
          actualTotalRowIdx = i;
        }
      }
    }
  }

  // Find Row Index for Month Numbers (usually the row containing Month names or Month header)
  const monthHeaderRowIdx = findRowByLabel("เดือน");

  for (let colIdx = 3; colIdx <= 22; colIdx++) {
    const mIdx = colIdx - 3;
    const mName = month_names[mIdx] || `Col ${colIdx}`;
    
    const rawMNum = monthHeaderRowIdx !== -1 ? rawPlanRows[monthHeaderRowIdx + 1]?.[colIdx] : null;
    const mNum = rawMNum && rawMNum.trim() !== "" && !isNaN(parseInt(rawMNum)) ? parseInt(rawMNum) : null;

    const categories = {
      A: {
        workers: getValFloat(catRows.A.workers, colIdx),
        cum_workers: getValFloat(catRows.A.cum_workers, colIdx),
        cum_value: getValFloat(catRows.A.cum_value, colIdx),
        productivity: getValFloat(catRows.A.productivity, colIdx)
      },
      B: {
        workers: getValFloat(catRows.B.workers, colIdx),
        cum_workers: getValFloat(catRows.B.cum_workers, colIdx),
        cum_value: getValFloat(catRows.B.cum_value, colIdx),
        productivity: getValFloat(catRows.B.productivity, colIdx)
      },
      C: {
        workers: getValFloat(catRows.C.workers, colIdx),
        cum_workers: getValFloat(catRows.C.cum_workers, colIdx),
        cum_value: getValFloat(catRows.C.cum_value, colIdx),
        productivity: getValFloat(catRows.C.productivity, colIdx)
      },
      D: {
        workers: getValFloat(catRows.D.workers, colIdx),
        cum_workers: getValFloat(catRows.D.cum_workers, colIdx),
        cum_value: getValFloat(catRows.D.cum_value, colIdx),
        productivity: getValFloat(catRows.D.productivity, colIdx)
      }
    };

    const totals = {
      male_workers: getValFloat(totalsRows.male_workers, colIdx),
      female_workers: getValFloat(totalsRows.female_workers, colIdx),
      total_workers: getValFloat(totalsRows.total_workers, colIdx),
      wage_cost: getValFloat(totalsRows.wage_cost, colIdx),
      ot_cost: getValFloat(totalsRows.ot_cost, colIdx),
      total_cost: getValFloat(totalsRows.total_cost, colIdx),
      cum_cost: getValFloat(totalsRows.cum_cost, colIdx),
      productivity: getValFloat(totalsRows.productivity, colIdx)
    };

    const actual = {
      period_1_15: getValFloat(actualPeriod1RowIdx, colIdx),
      period_16_31: getValFloat(actualPeriod2RowIdx, colIdx),
      total_cost: getValFloat(actualTotalRowIdx, colIdx)
    };

    plan_months.push({
      month_num: mNum,
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
