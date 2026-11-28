
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import HrDashboard from "../hr/dashboard/HRDashboard";
import PamsDashboard from "./PamsDashboard";
import { executeWmsInboundSql } from "../../api/wms";
import { useAuth } from "../../state/AuthContext";

type TabKey = "hr" | "pams";

// COO, CEO, HR - always have PAMS access
const FULL_ACCESS_CODES = [
  "2018030473",
  "2010080001",
  "2021060535",
];

const TABS: {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    key: "hr",
    label: "HR Dashboard",
    icon: Users,
  },
  {
    key: "pams",
    label: "PAMS Dashboard",
    icon: TrendingUp,
  },
];

const esc = (value: unknown) =>
  String(value ?? "").replace(/'/g, "''");

const TABS_CSS = `
.hcm-tabs-wrap {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}


.hcm-tabs-bar {
  display: flex;
  justify-content: flex-start;  
  align-items: center;
  width: 100%;
  padding: 1px 24px;
  box-sizing: border-box;
}

/* Tab container */
.hcm-tabs-track {
  display: inline-flex;
  align-items: center;           
  gap: 5px;
  padding: 1px;
  border-radius: 12px;
  
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03   );
}

/* Tab button */
.hcm-tab-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;

  min-height: 40px;
  padding: 0 20px;

  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;

  color: #64748b;
  font-family: Inter, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.1px;
  white-space: nowrap;

  cursor: pointer;

  transition:
    background 180ms ease,
    color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

/* Tab icon */
.hcm-tab-btn svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  stroke-width: 1.8;
  transition: transform 180ms ease;
}

/* Hover */
.hcm-tab-btn:hover:not(.active) {
  color: #00378c;
  background: rgba(0, 55, 140, 0.05);
}

.hcm-tab-btn:hover:not(.active) svg {
  transform: translateY(-1px);
}

/* Active tab */
.hcm-tab-btn.active {
  color: #00378c;
  background: #fff;
  border-color: #e1e8f2;
  box-shadow:
    0 2px 5px rgba(15, 23, 42, 0.06),
    0 1px 2px rgba(15, 23, 42, 0.03);
}

.hcm-tab-btn.active svg {
  color: #00378c;
  stroke-width: 2.1;
}

/* Keyboard focus */
.hcm-tab-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 3px;
  z-index: 1;
}

/* Dashboard panels */
.hcm-tabs-content {
  width: 100%;
  min-width: 0;
}

/* Responsive */
@media (max-width: 600px) {
  .hcm-tabs-bar {
    padding: 12px 14px;
  }

  .hcm-tabs-track {
    width: 100%;
    display: flex;
    gap: 4px;
  }

  .hcm-tab-btn {
    flex: 1;
    min-width: 0;
    padding: 0 10px;
    gap: 7px;
    font-size: 12px;
  }

  .hcm-tab-btn svg {
    width: 15px;
    height: 15px;
  }
}

/* Reduced motion accessibility */
@media (prefers-reduced-motion: reduce) {
  .hcm-tab-btn,
  .hcm-tab-btn svg {
    transition: none;
  }
}
`;

export default function HcmDashboardTabs() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] =
    useState<TabKey>("hr");

  // PAMS dashboard mounts only after the first click
  const [pamsVisited, setPamsVisited] =
    useState(false);

  const login = String(user?.LOGINID ?? "").trim();
  const company = String(user?.company_code ?? "").trim();

  const isFullAccess = FULL_ACCESS_CODES.includes(login);

  // Check whether normal user has PAMS document access
  const { data: roleCheck } = useQuery<any[] | null>({
    queryKey: ["pams_tab_access", login, company],
    enabled: !!login && !!company && !isFullAccess,
    staleTime: 10 * 60 * 1000,

    queryFn: async () => {
      const sql = `
        SELECT COUNT(*) AS CNT
        FROM EMS_APPRAISAL_HDR h
        WHERE h.COMPANY_CODE = '${esc(company)}'
          AND (
            TRIM(h.CREATED_BY) = '${esc(login)}'
            OR TRIM(h.HOD) = '${esc(login)}'
            OR TRIM(h.DEPT_HEAD) = '${esc(login)}'
          )
          AND ROWNUM = 1
      `;

      return (await executeWmsInboundSql(
        sql
      )) as any[] | null;
    },
  });

  const hasRole =
    Number(roleCheck?.[0]?.CNT ?? 0) > 0;

  const canSeePams = isFullAccess || hasRole;

  const visibleTabs = TABS.filter(
    (tab) => tab.key === "hr" || canSeePams
  );

  const currentTab: TabKey = canSeePams
    ? activeTab
    : "hr";

  const handleTab = (key: TabKey) => {
    if (key === "pams" && !canSeePams) {
      return;
    }

    if (key === "pams") {
      setPamsVisited(true);
    }

    setActiveTab(key);
  };

  return (
    <div className="hcm-tabs-wrap">
      <style>{TABS_CSS}</style>

      {/* Dashboard tabs */}
      {canSeePams && (
        <div className="hcm-tabs-bar">
          <div
            className="hcm-tabs-track"
            role="tablist"
            aria-label="Dashboard navigation"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                currentTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`${tab.key}-dashboard-tab`}
                  aria-selected={isActive}
                  aria-controls={`${tab.key}-dashboard-panel`}
                  tabIndex={isActive ? 0 : -1}
                  className={`hcm-tab-btn ${
                    isActive ? "active" : ""
                  }`}
                  onClick={() => handleTab(tab.key)}
                >
                  <Icon aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* HR Dashboard - always mounted */}
      <div
        id="hr-dashboard-panel"
        role="tabpanel"
        aria-labelledby="hr-dashboard-tab"
        aria-hidden={currentTab !== "hr"}
        className="hcm-tabs-content"
        style={{
          display:
            currentTab === "hr" ? "block" : "none",
        }}
      >
        <HrDashboard />
      </div>

      {/* PAMS Dashboard - lazy mounted */}
      {canSeePams && pamsVisited && (
        <div
          id="pams-dashboard-panel"
          role="tabpanel"
          aria-labelledby="pams-dashboard-tab"
          aria-hidden={currentTab !== "pams"}
          className="hcm-tabs-content"
          style={{
            display:
              currentTab === "pams"
                ? "block"
                : "none",
          }}
        >
          <PamsDashboard />
        </div>
      )}
    </div>
  );
}
