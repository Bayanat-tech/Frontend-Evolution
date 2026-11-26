import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import HrDashboard from "../hr/dashboard/HRDashboard";
import PamsDashboard from "./PamsDashboard";
import { executeWmsInboundSql } from "../../api/wms";
import { useAuth } from "../../state/AuthContext";

type TabKey = "hr" | "pams";

// COO, CEO, HR - hamesha PAMS tab dikhega
const FULL_ACCESS_CODES = ["2018030473", "2010080001", "2021060535"];

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "hr", label: "HR Dashboard", icon: Users },
  { key: "pams", label: "PAMS Dashboard", icon: TrendingUp },
];

const esc = (v: unknown) => String(v ?? "").replace(/'/g, "''");

const TABS_CSS = `
.hcm-tabs-wrap { display:flex; flex-direction:column; width:100%; }

/* Tab bar - normal flow (sticky nahi), page ke saath scroll hoga */
.hcm-tabs-bar {
  position: static;
  display: flex;
  align-items: center;
  padding: 12px 14px 4px;
  background: #fff;
}
.hcm-tabs-track {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}
.hcm-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 16px;
  border: none;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  transition: background .18s, color .18s, box-shadow .18s;
}
.hcm-tab-btn svg { width: 14px; height: 14px; }
.hcm-tab-btn:hover:not(.active) { color: #00378C; background: rgba(0,55,140,0.06); }
.hcm-tab-btn.active {
  background: #00378C;
  color: #fff;
  box-shadow: 0 2px 6px rgba(0,55,140,0.28);
}
.hcm-tab-btn:focus-visible { outline: 2px solid #00378C; outline-offset: 2px; }
`;

export default function HcmDashboardTabs() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("hr");
  // PAMS tab pehli baar click hone par hi mount hoga (queries tab hi chalengi)
  const [pamsVisited, setPamsVisited] = useState(false);

  const login = String(user?.LOGINID ?? "").trim();
  const company = String(user?.company_code ?? "").trim();
  const isFullAccess = FULL_ACCESS_CODES.includes(login);

  // Normal user: kya wo kisi doc me CREATED_BY / HOD / DEPT_HEAD hai?
  const { data: roleCheck } = useQuery<any[] | null>({
    queryKey: ["pams_tab_access", login, company],
    enabled: !!login && !!company && !isFullAccess,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const sql = `SELECT COUNT(*) AS CNT
        FROM EMS_APPRAISAL_HDR h
       WHERE h.COMPANY_CODE = '${esc(company)}'
         AND (TRIM(h.CREATED_BY) = '${esc(login)}'
              OR TRIM(h.HOD) = '${esc(login)}'
              OR TRIM(h.DEPT_HEAD) = '${esc(login)}')
         AND ROWNUM = 1`;
      return (await executeWmsInboundSql(sql)) as any[] | null;
    },
  });

  const hasRole = Number((roleCheck as any[])?.[0]?.CNT ?? 0) > 0;
  const canSeePams = isFullAccess || hasRole;

  const visibleTabs = TABS.filter((t) => t.key === "hr" || canSeePams);
  const currentTab: TabKey = canSeePams ? activeTab : "hr";

  const handleTab = (key: TabKey) => {
    if (key === "pams" && !canSeePams) return;
    if (key === "pams") setPamsVisited(true);
    setActiveTab(key);
  };

  return (
    <div className="hcm-tabs-wrap">
      <style>{TABS_CSS}</style>

      {/* Tab bar sirf tab dikhega jab user ke paas PAMS access ho */}
      {canSeePams && (
        <div className="hcm-tabs-bar">
          <div className="hcm-tabs-track" role="tablist">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`hcm-tab-btn ${isActive ? "active" : ""}`}
                  onClick={() => handleTab(tab.key)}
                >
                  <Icon />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* HR - default, hamesha mounted (state preserve rehti hai) */}
      <div style={{ display: currentTab === "hr" ? "block" : "none" }}>
        <HrDashboard />
      </div>

      {/* PAMS - sirf access wale user ko, pehli click ke baad mount */}
      {canSeePams && pamsVisited && (
        <div style={{ display: currentTab === "pams" ? "block" : "none" }}>
          <PamsDashboard />
        </div>
      )}
    </div>
  );
}