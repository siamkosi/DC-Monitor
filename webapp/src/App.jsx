import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CalendarRange,
  Sun,
  Moon,
  DollarSign,
  UserCheck,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  Layers,
  MapPin,
  TrendingUp,
  TrendingDown,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { parseGoogleSheetsData } from './googleSheetsParser';
import localJsonData from './data.json';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Google Sheets Integration State
  const [sheetId, setSheetId] = useState(() => localStorage.getItem('manpower_sheet_id') || '');
  const [tempSheetId, setTempSheetId] = useState(sheetId);
  const [data, setData] = useState(localJsonData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Apply dark class to html document
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Load Google Sheet data at startup if ID exists
  useEffect(() => {
    if (sheetId) {
      fetchSheetData(sheetId);
    }
  }, []);

  const fetchSheetData = async (id) => {
    if (!id || id.trim() === '') {
      setData(localJsonData);
      setSheetId('');
      localStorage.removeItem('manpower_sheet_id');
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const sheets = ["DC หมวด A-D", "Backup", "Feb26", "Mar26", "Apr26", "May26", "Jun26", "Jul26"];
      const sheetsData = {};
      
      for (const sheet of sheets) {
        // Fetch published CSV from Google Sheets GViz endpoint (CORS-friendly)
        const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`ไม่สามารถดึงข้อมูลแผ่นงาน "${sheet}" ได้ โปรดตรวจสอบว่าแชร์ไฟล์เป็นสาธารณะหรือยัง`);
        }
        const text = await res.text();
        sheetsData[sheet] = text;
      }
      
      const parsed = parseGoogleSheetsData(sheetsData);
      setData(parsed);
      localStorage.setItem('manpower_sheet_id', id);
      setSheetId(id);
      setSuccessMsg("เชื่อมโยงและซิงค์ข้อมูล Google Sheet สำเร็จ!");
      setTimeout(() => setSuccessMsg(null), 4000);
      setSettingsOpen(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheets");
      // Fallback to local data
      setData(localJsonData);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    fetchSheetData(tempSheetId);
  };

  const handleResetToDemo = () => {
    setTempSheetId('');
    fetchSheetData('');
    setSettingsOpen(false);
    setSuccessMsg("รีเซ็ตเป็นข้อมูลตัวอย่างแล้ว");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Extract raw data fields from active state data
  const { project_info, plan_months, manpower_backup, monthly_actuals } = data;

  // Chart colors palette
  const chartColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

  // ==========================================
  // Tab 1: Dashboard Calculations
  // ==========================================
  const dashboardStats = useMemo(() => {
    const totalPlannedBudget = plan_months[plan_months.length - 1]?.totals?.cum_cost || 0;
    const actualMonths = plan_months.filter(m => m.actual && m.actual.total_cost > 0);
    const totalActualSpent = actualMonths.reduce((sum, m) => sum + m.actual.total_cost, 0);
    const totalPlannedSpentForPeriod = plan_months.slice(0, actualMonths.length).reduce((sum, m) => sum + m.totals.total_cost, 0);
    const variance = totalPlannedSpentForPeriod - totalActualSpent;
    const variancePct = totalPlannedSpentForPeriod > 0 ? (variance / totalPlannedSpentForPeriod) * 100 : 0;
    const avgPlannedWorkers = actualMonths.reduce((sum, m) => sum + m.totals.total_workers, 0) / (actualMonths.length || 1);
    
    const actualSheetKeys = ["Feb26", "Mar26", "Apr26", "May26", "Jun26"];
    const actualWorkersPerMonth = actualSheetKeys.map(sheetKey => {
      const rows = monthly_actuals[sheetKey] || [];
      return rows.reduce((sum, r) => sum + r.total_people, 0);
    });
    const avgActualWorkers = actualWorkersPerMonth.reduce((sum, w) => sum + w, 0) / (actualWorkersPerMonth.length || 1);

    return {
      totalPlannedBudget,
      totalActualSpent,
      variance,
      variancePct,
      avgPlannedWorkers,
      avgActualWorkers,
      actualMonthsCount: actualMonths.length
    };
  }, [plan_months, monthly_actuals]);

  // ==========================================
  // Tab 2: Category Plan State
  // ==========================================
  const [selectedCategory, setSelectedCategory] = useState('A');
  const categoryDetails = useMemo(() => {
    return plan_months.map(m => {
      const catInfo = m.categories[selectedCategory] || { workers: 0, cum_workers: 0, cum_value: 0, productivity: 0 };
      const ratePerWorkerMonth = 11618.75;
      const sheetKey = m.month_name.replace(" ", "");
      const sheetRows = monthly_actuals[sheetKey] || [];
      const actualWorkers = sheetRows
        .filter(r => r.category === selectedCategory)
        .reduce((sum, r) => sum + r.total_people, 0);
        
      const plannedWorkers = catInfo.workers;
      const actualCost = actualWorkers * ratePerWorkerMonth;
      const plannedCost = plannedWorkers * ratePerWorkerMonth;
      
      return {
        month_name: m.month_name,
        planned_workers: plannedWorkers,
        cum_workers: catInfo.cum_workers,
        cum_value: catInfo.cum_value,
        productivity: catInfo.productivity,
        actual_workers: sheetRows.length > 0 ? actualWorkers : null,
        actual_cost: sheetRows.length > 0 ? actualCost : null,
        planned_cost: plannedCost,
        variance: sheetRows.length > 0 ? plannedCost - actualCost : null
      };
    });
  }, [plan_months, selectedCategory, monthly_actuals]);

  // ==========================================
  // Tab 3: Manpower Backup State
  // ==========================================
  const [backupSearch, setBackupSearch] = useState('');
  const [backupCategoryFilter, setBackupCategoryFilter] = useState('All');
  const [expandedPositionId, setExpandedPositionId] = useState(null);

  const filteredBackup = useMemo(() => {
    return manpower_backup.filter(item => {
      const matchSearch = item.position.toLowerCase().includes(backupSearch.toLowerCase()) || 
                          item.notes.toLowerCase().includes(backupSearch.toLowerCase());
      
      let matchCat = true;
      if (backupCategoryFilter !== 'All') {
        matchCat = item.notes.includes(`หมวด ${backupCategoryFilter}`) || 
                   item.position.includes(`หมวด ${backupCategoryFilter}`);
        if (!matchCat && item.notes) {
          matchCat = item.notes.includes(backupCategoryFilter);
        }
      }
      return matchSearch && matchCat;
    });
  }, [manpower_backup, backupSearch, backupCategoryFilter]);

  // ==========================================
  // Tab 4: Monthly Zone Analysis State
  // ==========================================
  const [selectedMonthSheet, setSelectedMonthSheet] = useState('Feb26');
  const [zoneCategoryFilter, setZoneCategoryFilter] = useState('All');

  const currentMonthData = useMemo(() => {
    return monthly_actuals[selectedMonthSheet] || [];
  }, [monthly_actuals, selectedMonthSheet]);

  const zoneChartData = useMemo(() => {
    const zones = { A: 0, B: 0, C: 0, D: 0, E: 0, LA: 0, Central: 0 };
    currentMonthData.forEach(row => {
      if (zoneCategoryFilter === 'All' || row.category === zoneCategoryFilter) {
        zones.A += row.zones.A;
        zones.B += row.zones.B;
        zones.C += row.zones.C;
        zones.D += row.zones.D;
        zones.E += row.zones.E;
        zones.LA += row.zones.LA;
        zones.Central += row.zones.Central;
      }
    });

    return Object.entries(zones).map(([name, value]) => ({ name, value }));
  }, [currentMonthData, zoneCategoryFilter]);

  const filteredMonthlyRows = useMemo(() => {
    return currentMonthData.filter(row => {
      if (zoneCategoryFilter === 'All') return true;
      return row.category === zoneCategoryFilter;
    });
  }, [currentMonthData, zoneCategoryFilter]);

  // ==========================================
  // ECharts Common Config Generator
  // ==========================================
  const themeTextColors = isDark ? '#a1a1aa' : '#71717a';
  const themeBorderColors = isDark ? '#27272a' : '#e4e4e7';
  const themeGridColors = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const tooltipBg = isDark ? '#18181b' : '#ffffff';
  const tooltipBorder = isDark ? '#27272a' : '#e4e4e7';
  const tooltipText = isDark ? '#fafafa' : '#09090b';

  // Chart 1: Plan vs Actual Cost
  const costChartOption = useMemo(() => {
    const categories = plan_months.map(m => m.month_name);
    const plannedCosts = plan_months.map(m => m.totals.total_cost);
    const actualCosts = plan_months.map(m => m.actual.total_cost > 0 ? m.actual.total_cost : null);
    
    const plannedCum = plan_months.map(m => m.totals.cum_cost);
    const actualCum = [];
    let tempCum = 0;
    plan_months.forEach(m => {
      if (m.actual.total_cost > 0) {
        tempCum += m.actual.total_cost;
        actualCum.push(tempCum);
      } else {
        actualCum.push(null);
      }
    });

    return {
      backgroundColor: 'transparent',
      color: [chartColors[0], chartColors[1], chartColors[4], chartColors[3]],
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText },
        formatter: (params) => {
          let html = `<div class="font-sans"><p class="font-bold text-sm mb-1">${params[0].name}</p>`;
          params.forEach(p => {
            if (p.value !== null && p.value !== undefined) {
              const valFormatted = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(p.value);
              html += `<div class="flex items-center justify-between gap-6 text-xs mt-1">
                <span class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" style="background-color: ${p.color}"></span>
                  ${p.seriesName}
                </span>
                <span class="font-bold">${valFormatted} บาท</span>
              </div>`;
            }
          });
          html += '</div>';
          return html;
        }
      },
      legend: {
        textStyle: { color: themeTextColors },
        data: ['ค่าแรงตามแผน/เดือน', 'ค่าแรงทำจริง/เดือน', 'ค่าแรงสะสมตามแผน', 'ค่าแรงสะสมทำจริง']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: themeBorderColors } },
          axisLabel: { color: themeTextColors, rotate: 30 }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: 'ค่าแรงต่อเดือน (บาท)',
          nameTextStyle: { color: themeTextColors },
          axisLabel: { 
            color: themeTextColors,
            formatter: (v) => `${(v / 1000).toFixed(0)}k`
          },
          splitLine: { lineStyle: { color: themeGridColors } }
        },
        {
          type: 'value',
          name: 'ค่าแรงสะสม (บาท)',
          nameTextStyle: { color: themeTextColors },
          axisLabel: { 
            color: themeTextColors,
            formatter: (v) => `${(v / 1000000).toFixed(1)}M`
          },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'ค่าแรงตามแผน/เดือน',
          type: 'bar',
          data: plannedCosts,
          barMaxWidth: 16
        },
        {
          name: 'ค่าแรงทำจริง/เดือน',
          type: 'bar',
          data: actualCosts,
          barMaxWidth: 16
        },
        {
          name: 'ค่าแรงสะสมตามแผน',
          type: 'line',
          yAxisIndex: 1,
          data: plannedCum,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3 }
        },
        {
          name: 'ค่าแรงสะสมทำจริง',
          type: 'line',
          yAxisIndex: 1,
          data: actualCum,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3, type: 'dashed' }
        }
      ]
    };
  }, [plan_months, isDark, themeTextColors, themeBorderColors, themeGridColors, tooltipBg, tooltipBorder, tooltipText]);

  // Chart 2: Worker Count Plan vs Actual
  const workerChartOption = useMemo(() => {
    const categories = plan_months.map(m => m.month_name);
    const plannedWorkers = plan_months.map(m => m.totals.total_workers);
    const actualSheetKeys = ["Feb26", "Mar26", "Apr26", "May26", "Jun26", "Jul26"];
    const actualWorkers = plan_months.map(m => {
      const sheetKey = m.month_name.replace(" ", "");
      if (actualSheetKeys.includes(sheetKey)) {
        const rows = monthly_actuals[sheetKey] || [];
        return rows.reduce((sum, r) => sum + r.total_people, 0);
      }
      return null;
    });

    return {
      backgroundColor: 'transparent',
      color: [chartColors[4], chartColors[2]],
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText },
        formatter: (params) => {
          let html = `<div class="font-sans"><p class="font-bold text-sm mb-1">${params[0].name}</p>`;
          params.forEach(p => {
            if (p.value !== null && p.value !== undefined) {
              html += `<div class="flex items-center justify-between gap-6 text-xs mt-1">
                <span class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" style="background-color: ${p.color}"></span>
                  ${p.seriesName}
                </span>
                <span class="font-bold">${p.value} คน</span>
              </div>`;
            }
          });
          html += '</div>';
          return html;
        }
      },
      legend: {
        textStyle: { color: themeTextColors },
        data: ['จำนวนแรงงานตามแผน', 'จำนวนแรงงานทำจริง']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: themeBorderColors } },
          axisLabel: { color: themeTextColors, rotate: 30 }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: 'จำนวนแรงงาน (คน)',
          nameTextStyle: { color: themeTextColors },
          axisLabel: { color: themeTextColors },
          splitLine: { lineStyle: { color: themeGridColors } }
        }
      ],
      series: [
        {
          name: 'จำนวนแรงงานตามแผน',
          type: 'line',
          data: plannedWorkers,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 3 }
        },
        {
          name: 'จำนวนแรงงานทำจริง',
          type: 'bar',
          data: actualWorkers,
          barMaxWidth: 16
        }
      ]
    };
  }, [plan_months, monthly_actuals, isDark, themeTextColors, themeBorderColors, themeGridColors, tooltipBg, tooltipBorder, tooltipText]);

  // Chart 3: Zone Distribution Donut
  const donutChartOption = useMemo(() => {
    return {
      backgroundColor: 'transparent',
      color: chartColors,
      tooltip: {
        trigger: 'item',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText },
        formatter: (params) => {
          return `<div class="font-sans text-xs">
            <span class="font-bold">${params.name}</span>: ${params.value} คน (${params.percent}%)
          </div>`;
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: '0',
        textStyle: { color: themeTextColors }
      },
      series: [
        {
          name: 'สัดส่วนตามพื้นที่/โซน',
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? '#0c0c0f' : '#ffffff',
            borderWidth: 2
          },
          label: {
            show: true,
            color: themeTextColors,
            formatter: '{b}: {c} คน'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            }
          },
          data: zoneChartData.filter(d => d.value > 0)
        }
      ]
    };
  }, [zoneChartData, isDark, themeTextColors, tooltipBg, tooltipBorder, tooltipText]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 font-sans transition-colors duration-200">
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-zinc-200/50 dark:border-zinc-800/50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-50 dark:to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
              LR9 ตารางควบคุม DC หมวด A-D
              {sheetId ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" />
                  Live Sync
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">
                  Demo
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              แผงวิเคราะห์และเปรียบเทียบข้อมูลแผนงานกำลังพลรายวัน
            </p>
          </div>
        </div>

        {/* Responsive Navigation Tabs - Always visible and wraps on small screens */}
        <nav className="flex flex-wrap items-center gap-1 bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            หน้าแรก (Dashboard)
          </button>
          <button
            id="tab-categories"
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === 'categories'
                ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            แผนรายหมวดงาน (A-D)
          </button>
          <button
            id="tab-backup"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Users className="w-4 h-4" />
            แผนรายตำแหน่ง (Backup)
          </button>
          <button
            id="tab-monthly"
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === 'monthly'
                ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            ทำจริงรายเดือน (Feb-Jul)
          </button>
        </nav>

        {/* Action Controls (Google Sheet Settings & Theme Toggle) */}
        <div className="flex items-center gap-2">
          {/* Settings Toggle */}
          <button
            id="btn-settings-toggle"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
              settingsOpen 
                ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400'
            }`}
            title="Google Sheets Settings"
          >
            <Settings className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Theme Toggle */}
          <button
            id="btn-dark-toggle"
            onClick={() => setIsDark(!isDark)}
            className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
          </button>
        </div>
      </header>

      {/* SUCCESS / ERROR NOTIFICATIONS */}
      <div className="max-w-[1600px] mx-auto px-6 mt-4 space-y-2">
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-400 rounded-xl p-3 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-800/30 text-rose-800 dark:text-rose-400 rounded-xl p-3 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            {error}
          </div>
        )}
      </div>

      {/* GOOGLE SHEETS SETTINGS DIALOG (MODAL OVERLAY) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c0c0f] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ตั้งค่าเชื่อมโยง Google Sheet
              </h3>
              <button 
                onClick={() => setSettingsOpen(false)} 
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-semibold"
              >
                ปิด
              </button>
            </div>

            {/* Guide section */}
            <div className="bg-zinc-50 dark:bg-[#09090b] border border-zinc-200/50 dark:border-zinc-800/50 rounded-xl p-4 space-y-3 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <h4 className="font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                วิธีแชร์และนำ Spreadsheet ID มาใช้งาน:
              </h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>เปิดไฟล์ข้อมูลของคุณใน **Google Sheets**</li>
                <li>ไปที่แถบเมนูหลักเลือก **ไฟล์ (File)** &gt; **แชร์ (Share)** &gt; **เผยแพร่ไปยังเว็บ (Publish to web)**</li>
                <li>กดปุ่ม **เผยแพร่ (Publish)** สีเขียว</li>
                <li>คัดลอก **Spreadsheet ID** จากแถบที่อยู่ URL ของเบราว์เซอร์</li>
                <li className="text-[10px] text-zinc-400 font-mono">ตัวอย่าง URL: https://docs.google.com/spreadsheets/d/<span className="text-blue-500 font-bold">1A2B3C4D...</span>/edit</li>
              </ol>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Google Spreadsheet ID
                </label>
                <input
                  type="text"
                  placeholder="ป้อน Spreadsheet ID ที่นี่..."
                  value={tempSheetId}
                  onChange={(e) => setTempSheetId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>

              <div className="flex items-center gap-2 justify-end pt-2">
                {sheetId && (
                  <button
                    type="button"
                    onClick={handleResetToDemo}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/15 border border-rose-200/50 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                  >
                    รีเซ็ตเป็น Demo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-300 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  ซิงค์ข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        
        {/* ========================================== */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ========================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">งบประมาณรวมตามแผนโครงการ</span>
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400"><DollarSign className="w-4 h-4" /></div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-extrabold tracking-tight">
                    {new Intl.NumberFormat('th-TH').format(dashboardStats.totalPlannedBudget)} <span className="text-xs font-normal">บาท</span>
                  </h3>
                  <p className="text-[10px] font-medium text-zinc-400">
                    ข้อมูลสะสมครบอายุสัญญา 15 เดือน
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ค่าแรงจ่ายจริงสะสม (ถึงปัจจุบัน)</span>
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400"><UserCheck className="w-4 h-4" /></div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-extrabold tracking-tight">
                    {new Intl.NumberFormat('th-TH').format(dashboardStats.totalActualSpent)} <span className="text-xs font-normal">บาท</span>
                  </h3>
                  <p className="text-[10px] font-medium text-zinc-400">
                    คิดจากข้อมูลจริงสะสม 5 เดือนแรก (ก.พ. 26 - มิ.ย. 26)
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">ผลต่างงบประมาณ (Variance)</span>
                  <div className={`p-2 rounded-lg ${dashboardStats.variance >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400'}`}>
                    {dashboardStats.variance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className={`text-2xl font-extrabold tracking-tight ${dashboardStats.variance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {dashboardStats.variance >= 0 ? '+' : ''}{new Intl.NumberFormat('th-TH').format(dashboardStats.variance)} <span className="text-xs font-normal">บาท</span>
                  </h3>
                  <p className="text-[10px] font-semibold flex items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded ${dashboardStats.variance >= 0 ? 'bg-emerald-100 dark:bg-emerald-950/30' : 'bg-rose-100 dark:bg-rose-950/30'}`}>
                      ประหยัดได้ {dashboardStats.variancePct.toFixed(1)}%
                    </span>
                    เมื่อเทียบกับแผน
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">อัตราเฉลี่ยแรงงานต่อเดือน</span>
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400"><Users className="w-4 h-4" /></div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-extrabold tracking-tight">
                    {dashboardStats.avgActualWorkers.toFixed(0)} <span className="text-xs font-normal">คน / เดือน</span>
                  </h3>
                  <p className="text-[10px] font-medium text-zinc-400">
                    เฉลี่ยตามแผน: {dashboardStats.avgPlannedWorkers.toFixed(0)} คน / เดือน
                  </p>
                </div>
              </div>

            </div>

            {/* Info alert */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 text-blue-900 dark:text-blue-300 rounded-xl p-4 flex gap-3 text-xs leading-relaxed">
              <Info className="w-4 h-4 shrink-0 text-blue-500" />
              <div>
                <strong>หมายเหตุการวิเคราะห์ข้อมูล:</strong> การแสดงผลจะเริ่มต้นในหน้าแสดงความต้องการกำลังพล (Dashboard) ซึ่งรวบรวมแผนงานรายวันสะสมหมวด A-D ทั้งโครงการ เปรียบเทียบกับสถิติมูลค่าค่าใช้จ่ายทำจริงในพื้นที่
              </div>
            </div>

            {/* Analytical Charts */}
            <div className="grid grid-cols-1 gap-6">
              
              <div className="bg-white dark:bg-[#0c0c0f] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold">การเปรียบเทียบค่าแรงสะสมและรายงวด (แผนงาน VS ทำจริง)</h4>
                  <p className="text-[10px] text-zinc-400">แสดงข้อมูลค่าแรงรายเดือน (แกนซ้าย) และค่าแรงรวมสะสม (แกนขวา)</p>
                </div>
                <div className="h-[400px] w-full">
                  <ReactECharts option={costChartOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

              <div className="bg-white dark:bg-[#0c0c0f] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold">จำนวนบุคลากรรายเดือน (แผนงาน VS ทำจริง)</h4>
                  <p className="text-[10px] text-zinc-400">แสดงแผนความต้องการกำลังพลแบบต่อเนื่อง เปรียบเทียบกับกำลังพลจริงสะสมในไซด์งาน</p>
                </div>
                <div className="h-[380px] w-full">
                  <ReactECharts option={workerChartOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: CATEGORY PLAN */}
        {/* ========================================== */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            
            {/* Category Select Toolbar */}
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">เลือกหมวดงานควบคุมหลัก</span>
              </div>
              <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 gap-1">
                {['A', 'B', 'C', 'D'].map(cat => (
                  <button
                    key={cat}
                    id={`btn-cat-${cat}`}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                      selectedCategory === cat
                        ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    หมวด {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Details Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">
                    คำอธิบายหมวดงาน {selectedCategory}
                  </h3>
                  <div className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 space-y-3">
                    {selectedCategory === 'A' && (
                      <p><strong>หมวด A - งานประจำในไซต์งาน (Site Support & Security):</strong> ประกอบไปด้วยทีมงานเซอร์เวย์/ตีไลน์, งานสโตร์/เช็กเกอร์, งานดูแลบำรุงรักษาหน้างานระบบไฟฟ้า/ประปา, งานทำความสะอาดสำนักงาน และงานด้านเครื่องจักร (เช่น เครนทาวเวอร์, ลิฟต์ขนส่ง, คนขับรถยนต์)</p>
                    )}
                    {selectedCategory === 'B' && (
                      <p><strong>หมวด B - งานพื้นที่บริเวณชั้น 1 (Sub-Structure & Grounds):</strong> งานเกี่ยวข้องกับการป้องกันดินพัง/งานขุดเจาะใต้ดิน, งานทำความสะอาดล้างล้อ, งานจราจรโดยรอบและระบบความปลอดภัยระดับพื้นดิน, งานขนย้ายจัดเรียงกองวัสดุกลาง</p>
                    )}
                    {selectedCategory === 'C' && (
                      <p><strong>หมวด C - งานในอาคาร (Interior Fit-Out & Services):</strong> การเคลียร์และทำความสะอาดแยกตามชั้นอาคาร, งานลำเลียงยกขึ้นของหรือทิ้งเศษวัสดุลงล่าง, การบริหารพื้นที่จัดเก็บขยะชั้นก่อสร้าง</p>
                    )}
                    {selectedCategory === 'D' && (
                      <p><strong>หมวด D - งานส่วนกลาง (Common Services & Management):</strong> งานจัดระเบียบโซนความปลอดภัยโครงการ, งานป้อมยาม, คลังย่อยชั่วคราว, งานระบบอำนวยความสะดวกกลาง, ตลอดจนงานด้านชุมชนสัมพันธ์และสิ่งแวดล้อม (CSR/EIA)</p>
                    )}

                    <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span>สัดส่วนค่าแรงต่อวัน:</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                          {selectedCategory === 'A' ? '25%' : selectedCategory === 'B' ? '30%' : selectedCategory === 'C' ? '35%' : '10%'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>จำนวนแรงงานสูงสุดตามแผน:</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                          {Math.max(...categoryDetails.map(m => m.planned_workers))} คน
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>ค่าประมาณเป้าหมายเฉลี่ย:</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                          {Math.round(categoryDetails.reduce((sum, m) => sum + m.planned_workers, 0) / categoryDetails.length)} คน / เดือน
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table list */}
              <div className="lg:col-span-2 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h4 className="text-sm font-semibold">ตารางวิเคราะห์แผนรายเดือน หมวด {selectedCategory}</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                        <th className="p-3 font-semibold">เดือน</th>
                        <th className="p-3 font-semibold text-right">แรงงานที่แผน (คน)</th>
                        <th className="p-3 font-semibold text-right">แรงงานจริง (คน)</th>
                        <th className="p-3 font-semibold text-right">งบสะสมแผน (บาท)</th>
                        <th className="p-3 font-semibold text-right">งบสะสมจริง (บาท)</th>
                        <th className="p-3 font-semibold text-right">ผลต่าง (Variance)</th>
                        <th className="p-3 font-semibold text-right">Productivity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {categoryDetails.map((m, idx) => {
                        const isActualAvailable = m.actual_workers !== null;
                        const varianceStatusClass = m.variance >= 0 ? 'text-emerald-500' : 'text-rose-500';
                        return (
                          <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                            <td className="p-3 font-semibold">{m.month_name}</td>
                            <td className="p-3 text-right">{m.planned_workers.toFixed(0)}</td>
                            <td className="p-3 text-right text-zinc-500">
                              {isActualAvailable ? m.actual_workers.toFixed(0) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono text-zinc-400">
                              {new Intl.NumberFormat('th-TH').format(m.cum_value)}
                            </td>
                            <td className="p-3 text-right font-mono text-zinc-500">
                              {isActualAvailable ? new Intl.NumberFormat('th-TH').format(m.actual_cost) : '-'}
                            </td>
                            <td className={`p-3 text-right font-mono font-semibold ${varianceStatusClass}`}>
                              {isActualAvailable ? (m.variance >= 0 ? '+' : '') + new Intl.NumberFormat('th-TH').format(m.variance) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono text-blue-500 dark:text-blue-400">
                              {m.productivity.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: MANPOWER BACKUP */}
        {/* ========================================== */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            
            {/* Toolbar search & filters */}
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="w-full md:w-80 relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  id="search-backup"
                  type="text"
                  placeholder="ค้นหาตามชื่อตำแหน่ง หรือ หมวดงานย่อย..."
                  value={backupSearch}
                  onChange={(e) => setBackupSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">กรองหมวดงานหลัก:</span>
                <select
                  id="select-cat-backup"
                  value={backupCategoryFilter}
                  onChange={(e) => setBackupCategoryFilter(e.target.value)}
                  className="bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-40"
                >
                  <option value="All">ทั้งหมด (หมวด A-D)</option>
                  <option value="หมวด A">หมวด A (งานประจำไซต์)</option>
                  <option value="หมวด B">หมวด B (พื้นที่ชั้น 1)</option>
                  <option value="หมวด C">หมวด C (งานในอาคาร)</option>
                  <option value="หมวด D">หมวด D (พื้นที่ภายนอก)</option>
                </select>
              </div>
            </div>

            {/* Manpower Backup Table */}
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <h4 className="text-sm font-semibold">ตารางแผนจัดจ้างกำลังพล (Manpower Backup List)</h4>
                <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 font-bold">
                  พบ {filteredBackup.length} รายการ
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                      <th className="p-3 w-10 text-center font-semibold">ลำดับ</th>
                      <th className="p-3 font-semibold">ตำแหน่งงาน (Position)</th>
                      <th className="p-3 font-semibold">รหัสควบคุม / หมายเหตุ</th>
                      <th className="p-3 font-semibold text-right">จำนวนสะสมคน-เดือน</th>
                      <th className="p-3 w-12 text-center">ดูรายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {filteredBackup.map((item) => {
                      const isExpanded = expandedPositionId === item.id;
                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            id={`row-pos-${item.id}`}
                            onClick={() => setExpandedPositionId(isExpanded ? null : item.id)}
                            className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 cursor-pointer transition-colors"
                          >
                            <td className="p-3 text-center text-zinc-400">{item.id}</td>
                            <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">{item.position}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                                {item.notes}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-zinc-600 dark:text-zinc-300">
                              {item.total.toFixed(0)}
                            </td>
                            <td className="p-3 text-center">
                              <button 
                                id={`btn-expand-${item.id}`}
                                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded detail row showing worker count per month */}
                          {isExpanded && (
                            <tr className="bg-zinc-50/50 dark:bg-zinc-900/30">
                              <td colSpan={5} className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                      แผนความต้องการกำลังพลแยกตามเดือน (คน / เดือน)
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-16 gap-2">
                                    {Object.entries(item.counts).map(([month, val]) => (
                                      <div
                                        key={month}
                                        className={`p-2 rounded-lg border text-center transition-all ${
                                          val > 0
                                            ? 'bg-blue-50/40 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/30'
                                            : 'bg-zinc-100/50 dark:bg-zinc-900/40 border-zinc-200/30 dark:border-zinc-800/30'
                                        }`}
                                      >
                                        <div className="text-[9px] font-semibold text-zinc-400">{month}</div>
                                        <div className={`text-xs font-extrabold ${val > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`}>
                                          {val}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: MONTHLY ZONE ANALYSIS */}
        {/* ========================================== */}
        {activeTab === 'monthly' && (
          <div className="space-y-6">
            
            {/* Monthly and Category filter toolbar */}
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">เลือกช่วงเดือนเพื่อวิเคราะห์พื้นที่ทำงาน:</span>
              </div>
              <div className="flex flex-wrap bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 gap-1 w-full lg:w-auto justify-around">
                {['Feb26', 'Mar26', 'Apr26', 'May26', 'Jun26', 'Jul26'].map(sheetKey => (
                  <button
                    key={sheetKey}
                    id={`btn-month-${sheetKey}`}
                    onClick={() => setSelectedMonthSheet(sheetKey)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      selectedMonthSheet === sheetKey
                        ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {sheetKey.slice(0, 3)} {sheetKey.slice(3)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">หมวดงาน:</span>
                <select
                  id="select-cat-monthly"
                  value={zoneCategoryFilter}
                  onChange={(e) => setZoneCategoryFilter(e.target.value)}
                  className="bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none w-full lg:w-40"
                >
                  <option value="All">ทั้งหมด (หมวด A-D)</option>
                  <option value="A">หมวด A (งานไซต์สนับสนุน)</option>
                  <option value="B">หมวด B (งานบริเวณชั้น 1)</option>
                  <option value="C">หมวด C (งานในอาคาร)</option>
                  <option value="D">หมวด D (งานภายนอก/ส่วนกลาง)</option>
                </select>
              </div>
            </div>

            {/* Split screen: Chart on left, subcategory list on right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Zone distribution Chart */}
              <div className="lg:col-span-4 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-semibold">สัดส่วนกำลังพลจริงแยกตามพื้นที่หน้างาน (Zones)</h4>
                  <p className="text-[10px] text-zinc-400">ประจำเดือน {selectedMonthSheet}</p>
                </div>
                <div className="h-[280px] w-full">
                  {zoneChartData.some(d => d.value > 0) ? (
                    <ReactECharts option={donutChartOption} style={{ height: '100%', width: '100%' }} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                      ไม่มีกำลังพลลงปฏิบัติงานจริงในหมวดนี้
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Detailed subcategories table */}
              <div className="lg:col-span-8 bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[500px]">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                  <h4 className="text-sm font-semibold">รายการจัดแบ่งการกระจายงานย่อย</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
                    {filteredMonthlyRows.length} รายการงานย่อย
                  </span>
                </div>
                <div className="overflow-y-auto grow">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                        <th className="p-3 font-semibold w-16">รหัสงาน</th>
                        <th className="p-3 font-semibold">กิจกรรม / หมวดงานย่อย</th>
                        <th className="p-3 font-semibold text-center w-12">หมวด</th>
                        <th className="p-3 font-semibold text-center">การกระจายรายพื้นที่ (โซน A-Central)</th>
                        <th className="p-3 font-semibold text-right w-20">คนจ่ายจริง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {filteredMonthlyRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                          <td className="p-3 font-mono font-semibold text-zinc-400">{row.code}</td>
                          <td className="p-3 font-medium text-zinc-800 dark:text-zinc-200">{row.description}</td>
                          <td className="p-3 text-center">
                            <span className="px-1.5 py-0.5 rounded font-bold text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50">
                              {row.category}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1 items-center justify-center">
                              {Object.entries(row.zones).map(([zone, val]) => {
                                if (val === 0) return null;
                                return (
                                  <span key={zone} className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-blue-50/40 dark:bg-blue-950/10 text-blue-600 dark:text-blue-400 border border-blue-200/20 dark:border-blue-800/20">
                                    {zone}: {val.toFixed(0)}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                            {row.total_people.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
