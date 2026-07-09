import React, { useEffect, useState } from 'react';
import {
  Printer,
  RotateCcw,
  BarChart2,
  Loader2,
  Download,
} from 'lucide-react';
// import useAuth from 'hooks/useAuth';
// import ReportDialogPage from 'report/ReportDialogPage';
// import OutstandingStatementReport from './OutstandingStatementReport';
import { getDynamicLookup, getDynamicLookupaccount } from '../../../api/lookups';
import { useAuth } from '../../../state/AuthContext';
import { exportOutstandingDetailExcel, exportOutstandingSummaryExcel, openOutstandingStatementDetailReport, openOutstandingStatementSummaryReport } from '../../../api/transactions';


// ─── Helpers ──────────────────────────────────────────────────────────────────


const getRowKey = (row: any, tab: 'acCode' | 'group'): string =>
  tab === 'acCode' ? String(row.ac_code ?? '') : String(row.l4_code ?? '');


function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function formatDateOracle(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${d}-${months[parseInt(m, 10) - 1]}-${y}`;
}


// ─── Shared styles ────────────────────────────────────────────────────────────


const thStyle: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'left',
  fontWeight: 500,
  fontSize: 11,
  background: '#185FA5',
  color: '#fff',
};


const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 11,
  borderBottom: '0.5px solid #e5e7eb',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 0,
};


const rowStyle = (sel: boolean): React.CSSProperties => ({
  cursor: 'pointer',
  background: sel ? '#E6F1FB' : 'transparent',
  color: sel ? '#0C447C' : 'inherit',
});


const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: '#6b7280',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};


const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '6px 9px',
  border: '0.5px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#111827',
  boxSizing: 'border-box',
};


const badgeStyle: React.CSSProperties = {
  background: '#E6F1FB',
  color: '#0C447C',
  fontSize: 10,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 20,
};


const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  cursor: 'pointer',
  color: '#374151',
};


// ─── Component ────────────────────────────────────────────────────────────────


const OutstandingStatementPage: React.FC = () => {
  const { user } = useAuth();
  const companyCode = user?.company_code ?? '';
  const loginId = user?.loginid ?? '';


  // ── Division state ──────────────────────────────────────────────────────────
  const [divisionList, setDivisionList] = useState<any[]>([]);
  const [division, setDivision] = useState('');
  const [divisionDisplay, setDivisionDisplay] = useState('');
  const [divisionSearch, setDivisionSearch] = useState('');
  const [showDivisionDropdown, setShowDivisionDropdown] = useState(false);


  // ── A/C Code list + selection state ─────────────────────────────────────────
  const [acLeftItems, setAcLeftItems] = useState<any[]>([]);
  const [acLeftSelected, setAcLeftSelected] = useState(new Set<string>());
  const [acSearchLeft, setAcSearchLeft] = useState('');


  // ── Group list + selection state ────────────────────────────────────────────
  const [groupLeftItems, setGroupLeftItems] = useState<any[]>([]);
  const [groupLeftSelected, setGroupLeftSelected] = useState(new Set<string>());
  const [groupSearchLeft, setGroupSearchLeft] = useState('');


  // ── Other state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'acCode' | 'group'>('acCode');
  const [reportType, setReportType] = useState<'detail' | 'summary'>('detail');

  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [reportOpen, setReportOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [generatingExcel, setGeneratingExcel] = useState(false);


  // ── Track fetched tabs ──────────────────────────────────────────────────────
  const [fetchedTabs, setFetchedTabs] = useState<Set<string>>(new Set());


  // ── Fetch divisions on mount ────────────────────────────────────────────────
  useEffect(() => {
    getDynamicLookup({
      parameter: 'Account_division',
      loginid: loginId,
      code1: companyCode,
      code2: '', code3: '', code4: '',
      number1: 0, number2: 0, number3: 0, number4: 0,
      date1: null, date2: null, date3: null, date4: null,
    })
      .then((res) => setDivisionList(res || []))
      .catch(console.error);
  }, []);


  // ── On division change: reset all, fetch active tab ────────────────────────
  useEffect(() => {
    if (!division) return;
    setAcLeftItems([]);
    setAcLeftSelected(new Set());
    setGroupLeftItems([]);
    setGroupLeftSelected(new Set());
    setFetchedTabs(new Set());


    if (activeTab === 'acCode') fetchAccounts(division);
    else fetchGroups(division);
  }, [division]);


  // ── On tab change: fetch if not yet fetched ─────────────────────────────────
  useEffect(() => {
    if (!division || fetchedTabs.has(activeTab)) return;
    if (activeTab === 'acCode') fetchAccounts(division);
    else fetchGroups(division);
  }, [activeTab]);


  const fetchAccounts = async (div: string) => {
    try {
      const res = await getDynamicLookupaccount({
        parameter: 'Account_Report_AC',
        code1: companyCode,
        code2: div,
      });
      const unique = Array.from(
        new Map((res || []).map((i: any) => [i.ac_code, i])).values()
      ) as any[];
      setAcLeftItems(unique);
      setAcLeftSelected(new Set());
      setFetchedTabs((p) => new Set(p).add('acCode'));
    } catch (e) { console.error(e); }
  };


  const fetchGroups = async (div: string) => {
    try {
      const res = await getDynamicLookupaccount({
        parameter: 'Account_Report_Group',
        code1: companyCode,
        code2: div,
      });
      setGroupLeftItems(res || []);
      setGroupLeftSelected(new Set());
      setFetchedTabs((p) => new Set(p).add('group'));
    } catch (e) { console.error(e); }
  };


  // ── Selection helpers ───────────────────────────────────────────────────────
  const toggleSel = (code: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    set((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const toggleAllSelection = (
    items: any[],
    selected: Set<string>,
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>,
    keyField: string
  ) => {
    const itemKeys = new Set(items.map((item) => item[keyField]));
    const allSelected = items.length > 0 && items.every((item) => selected.has(item[keyField]));
    setSelected(allSelected ? new Set() : itemKeys);
  };


  // ── Reset ───────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setAcLeftSelected(new Set());
    setGroupLeftSelected(new Set());
    setReportError(null);
  };


  // ── Filtered lists ──────────────────────────────────────────────────────────
  const filteredAcLeft = acLeftItems.filter(
    (i) =>
      i.ac_code?.toLowerCase().includes(acSearchLeft.toLowerCase()) ||
      i.ac_name?.toLowerCase().includes(acSearchLeft.toLowerCase())
  );
  const filteredGroupLeft = groupLeftItems.filter(
    (i) =>
      i.l4_code?.toLowerCase().includes(groupSearchLeft.toLowerCase()) ||
      i.description?.toLowerCase().includes(groupSearchLeft.toLowerCase())
  );
  const filteredDivisions = divisionList.filter((d: any) =>
    `${d.div_code} ${d.div_name}`.toLowerCase().includes(divisionSearch.toLowerCase())
  );


  // ── Report values ─────────────────────────────────────────────────────────
  const reportValues = {
    loginid: user?.loginid ?? '',
    company_code: user?.company_code ?? '',
    date_from: dateFrom.split('-').reverse().join('/'),
    date_to: dateTo.split('-').reverse().join('/'),
    currency: reportType,
    division: division || 'All',
    ac_codes:
      activeTab === 'acCode'
        ? acLeftSelected.size > 0 ? Array.from(acLeftSelected).join(',') : 'All'
        : 'All',
    l4_codes:
      activeTab === 'group'
        ? groupLeftSelected.size > 0 ? Array.from(groupLeftSelected).join(',') : 'All'
        : 'All',
    selected_groups:
      activeTab === 'acCode'
        ? Array.from(acLeftSelected)
        : Array.from(groupLeftSelected),
  };


  const handleGenerate = async () => {
    if (!division) {
      setReportError("Please select a Division before generating.");
      return;
    }
    setReportError(null);
    setGenerating(true);
    try {
      const params = {
        parameter: reportType === 'detail'
          ? 'Account_Report_Outstanding_Detail'
          : 'Account_Report_Outstanding_Summary',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
        code2: division,
        code3: activeTab === 'acCode'
          ? (acLeftSelected.size > 0
            ? Array.from(acLeftSelected).join(',')
            : 'All')
          : 'All',
        code4: activeTab === 'group'
          ? (groupLeftSelected.size > 0
            ? Array.from(groupLeftSelected).join(',')
            : 'All')
          : 'All',
        code5: 'OMR',
        code6: formatDateOracle(dateFrom),
        code20: "RAWSQL",

      };

      console.log("Report params------:", params);

      if (reportType === 'detail') {
        await openOutstandingStatementDetailReport(params);
      } else {
        await openOutstandingStatementSummaryReport(params);
      }
    } catch (err: any) {
      setReportError("Failed to generate report.");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportExcel = async () => {
    if (!division) {
      setReportError("Please select a Division before exporting.");
      return;
    }
    setReportError(null);
    setGeneratingExcel(true);
    try {
      const params = {
        parameter: reportType === 'detail'
          ? 'Account_Report_Outstanding_Detail'
          : 'Account_Report_Outstanding_Summary',
        loginid: user?.loginid ?? '',
        code1: user?.company_code ?? '',
        code2: division,
        code3: activeTab === 'acCode'
          ? (acLeftSelected.size > 0 ? Array.from(acLeftSelected).join(',') : 'All')
          : 'All',
        code4: activeTab === 'group'
          ? (groupLeftSelected.size > 0 ? Array.from(groupLeftSelected).join(',') : 'All')
          : 'All',
        code5: 'OMR',
        code6: formatDateOracle(dateFrom),
        code20: "RAWSQL",
      };

      if (reportType === 'detail') {
        await exportOutstandingDetailExcel(params);
      } else {
        await exportOutstandingSummaryExcel(params);
      }
    } catch (err: any) {
      setReportError("Failed to export Excel.");
      console.error(err);
    } finally {
      setGeneratingExcel(false);
    }
  };





  return (
    <div style={{ background: '#f3f4f6', padding: '6px 10px', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .tf-btn:hover { background: #f0f7ff !important; border-color: #185FA5 !important; color: #185FA5 !important; }
        .tab-ac { padding: 7px 18px; border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 500; color: #9ca3af; border-bottom: 2px solid transparent; margin-bottom: -0.5px; }
        .tab-ac.active { color: #185FA5; border-bottom-color: #185FA5; }
        .action-btn:hover { background: #f9fafb !important; }
        .action-btn-primary:hover { background: #0C447C !important; border-color: #0C447C !important; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        tbody tr:last-child td { border-bottom: none !important; }
        tbody tr:hover td { background: #f9fafb; }
        .div-option:hover { background: #f0f7ff; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .action-btn-excel:hover { background: #EBF4FF !important; border-color: #185FA5 !important; color: #185FA5 !important; }
      `}</style>


      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>


        {/* ══ Card 1: Filters ══════════════════════════════════════════════════ */}
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '5px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <BarChart2 size={18} color="#185FA5" />
            <span style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>Outstanding Statement Filter</span>
          </div>


          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>

            {/* Division searchable dropdown */}
            <div style={{ flex: '2 1 220px', minWidth: 180, position: 'relative' }}>
              <div style={{ ...fieldLabelStyle, marginBottom: 1 }}>Division</div>
              <input
                type="text"
                placeholder="Search division..."
                value={divisionSearch !== '' ? divisionSearch : divisionDisplay}
                onChange={(e) => { setDivisionSearch(e.target.value); setShowDivisionDropdown(true); }}
                onFocus={() => setShowDivisionDropdown(true)}
                onBlur={() => setTimeout(() => setShowDivisionDropdown(false), 150)}
                style={inputStyle}
              />
              {showDivisionDropdown && filteredDivisions.length > 0 && (
                <div style={{
                  position: 'absolute', zIndex: 100, top: 'calc(100% + 2px)', left: 0, right: 0,
                  background: '#fff', border: '0.5px solid #d1d5db', borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
                }}>
                  {filteredDivisions.map((d: any) => (
                    <div
                      key={d.div_code}
                      className="div-option"
                      style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}
                      onMouseDown={() => {
                        setDivision(d.div_code);
                        setDivisionDisplay(`${d.div_code} - ${d.div_name}`);
                        setDivisionSearch('');
                        setShowDivisionDropdown(false);
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{d.div_code}</span>
                      <span style={{ color: '#6b7280', marginLeft: 6 }}>{d.div_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>


            {/* As On Date */}
            <div style={{ flex: '1 1 150px', minWidth: 140 }}>
              <div style={{ ...fieldLabelStyle, marginBottom: 1 }}>As On</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={inputStyle}
              />
            </div>


            <div style={{ flex: '1 1 160px', minWidth: 150 }}>
              <fieldset style={{ border: '0.5px solid #d1d5db', borderRadius: 6, padding: '5px 12px 7px', margin: 0 }}>
                <legend style={{ fontSize: 10, color: '#6b7280', padding: '0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Option
                </legend>
                <div style={{ display: 'flex', gap: 14 }}>
                  {(['detail', 'summary'] as const).map((val) => (
                    <label key={val} style={radioLabelStyle}>
                      <input
                        type="radio"
                        name="os-option"
                        value={val}
                        checked={reportType === val}
                        onChange={() => setReportType(val)}
                        style={{ accentColor: '#185FA5' }}
                      />
                      {val === 'detail' ? 'Detail' : 'Summary'}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          {reportError && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 6, padding: '6px 12px' }}>
              {reportError}
            </div>
          )}
        </div>


        {/* ══ Card 2: A/c Code / Group list ════════════════════════════════════ */}
        <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '0px 10px' }}>


          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', marginBottom: 10 }}>
            {([['acCode', 'A/c Code'], ['group', 'Group']] as ['acCode' | 'group', string][]).map(([tab, label]) => (
              <button
                key={tab}
                className={`tab-ac ${activeTab === tab ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab); }}
              >
                {label}
              </button>
            ))}
          </div>


          {/* ── A/C Code tab ── */}
          {activeTab === 'acCode' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Accounts
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {acLeftSelected.size > 0 && (
                    <span style={badgeStyle}>{acLeftSelected.size} selected</span>
                  )}
                  <span style={badgeStyle}>{acLeftItems.length} total</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={acSearchLeft}
                  onChange={(e) => setAcSearchLeft(e.target.value)}
                  style={{ ...inputStyle, fontSize: 12 }}
                />
              </div>
              <div style={{ border: '0.5px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 36 }}>
                        <input
                          type="checkbox"
                          checked={acLeftItems.length > 0 && acLeftItems.every((i) => acLeftSelected.has(i.ac_code))}
                          onChange={() => toggleAllSelection(acLeftItems, acLeftSelected, setAcLeftSelected, 'ac_code')}
                          style={{ accentColor: '#fff', cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ ...thStyle, width: 100 }}>A/C Code</th>
                      <th style={thStyle}>AC Name</th>
                      <th style={{ ...thStyle, width: 70 }}>Currency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAcLeft.map((row) => (
                      <tr
                        key={row.ac_code}
                        style={rowStyle(acLeftSelected.has(row.ac_code))}
                        onClick={() => toggleSel(row.ac_code, setAcLeftSelected)}
                      >
                        <td style={{ ...tdStyle, width: 36 }}>
                          <input
                            type="checkbox"
                            checked={acLeftSelected.has(row.ac_code)}
                            onChange={() => toggleSel(row.ac_code, setAcLeftSelected)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ accentColor: '#185FA5', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={tdStyle}>{row.ac_code}</td>
                        <td style={tdStyle}>{row.ac_name}</td>
                        <td style={tdStyle}>{row.curr_code}</td>
                      </tr>
                    ))}
                    {filteredAcLeft.length === 0 && (
                      <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', padding: 16 }}>
                        {division ? 'No data' : 'Select a division first'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* ── Group tab ── */}
          {activeTab === 'group' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Groups
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {groupLeftSelected.size > 0 && (
                    <span style={badgeStyle}>{groupLeftSelected.size} selected</span>
                  )}
                  <span style={badgeStyle}>{groupLeftItems.length} total</span>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Search groups..."
                  value={groupSearchLeft}
                  onChange={(e) => setGroupSearchLeft(e.target.value)}
                  style={{ ...inputStyle, fontSize: 12 }}
                />
              </div>
              <div style={{ border: '0.5px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 36 }}>
                        <input
                          type="checkbox"
                          checked={groupLeftItems.length > 0 && groupLeftItems.every((i) => groupLeftSelected.has(i.l4_code))}
                          onChange={() => toggleAllSelection(groupLeftItems, groupLeftSelected, setGroupLeftSelected, 'l4_code')}
                          style={{ accentColor: '#fff', cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ ...thStyle, width: 100 }}>L4 Code</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroupLeft.map((row) => (
                      <tr
                        key={row.l4_code}
                        style={rowStyle(groupLeftSelected.has(row.l4_code))}
                        onClick={() => toggleSel(row.l4_code, setGroupLeftSelected)}
                      >
                        <td style={{ ...tdStyle, width: 36 }}>
                          <input
                            type="checkbox"
                            checked={groupLeftSelected.has(row.l4_code)}
                            onChange={() => toggleSel(row.l4_code, setGroupLeftSelected)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ accentColor: '#185FA5', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={tdStyle}>{row.l4_code}</td>
                        <td style={tdStyle}>{row.description}</td>
                      </tr>
                    ))}
                    {filteredGroupLeft.length === 0 && (
                      <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', padding: 16 }}>
                        {division ? 'No data' : 'Select a division first'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #e5e7eb' }}>
            <button
              className="action-btn action-btn-excel"
              onClick={handleReset}
              style={{ padding: '7px 16px', border: '0.5px solid #d1d5db', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 6, color: '#374151' }}
            >
              <RotateCcw size={13} /> Reset
            </button>


            <button
              className="action-btn action-btn-excel"
              onClick={handleExportExcel}
              disabled={generatingExcel}
              style={{ padding: '7px 16px', border: '0.5px solid #d1d5db', background: '#fff', cursor: generatingExcel ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 6, color: '#374151', opacity: generatingExcel ? 0.7 : 1 }}
            >
              <Download size={13} /> {generatingExcel ? 'Exporting...' : 'Export Excel'}
            </button>


            <button
              className="action-btn-primary"
              onClick={handleGenerate}
              disabled={generating}
              style={{ padding: '7px 16px', border: '0.5px solid #185FA5', background: '#185FA5', cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 6, color: '#fff', opacity: generating ? 0.7 : 1 }}
            >
              {generating
                ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                : <><Printer size={13} /> Generate Report</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default OutstandingStatementPage;