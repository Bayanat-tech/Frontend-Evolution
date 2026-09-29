// import { useEffect, useState } from "react";
// import {
//   LayoutDashboard, Boxes, Truck, ArrowRightLeft, DollarSign,
//   Users, Clock, CheckCircle2, AlertCircle, RefreshCw, BarChart3, PieChartIcon
// } from "lucide-react";
// import { Button } from "../../../components/ui/Button";
// import { useAuth } from "../../../state/AuthContext";
// import { executeWmsInboundSql } from "../../../api/wms";
// import {
//   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
//   AreaChart, Area, PieChart, Pie, Cell
// } from "recharts";

// // ---------------------------------------------------------------------------
// // Types
// // ---------------------------------------------------------------------------
// interface InboundStats {
//   TOTAL_JOBS: number;
//   PUTAWAY_JOB_PENDING: number;
//   CONFIRM_PEND_FOR_COMP_PUTAWAY: number;
//   TOTAL_CONFIRM_GRN: number;
//   TOTAL_REVENUE_INBOUND: number;
// }

// interface OutboundStats {
//   TOTAL_JOBS: number;
//   PICK_JOB_PENDING: number;
//   CONFIRM_PEND_FOR_COMP_PICK: number;
//   TOTAL_CONFIRM_DN: number;
//   TOTAL_REVENUE_OUTBOUND: number;
// }

// interface TransferStats {
//   TOTAL_TRANSFER: number;
//   TRANSFER_JOB_PENDING: number;
//   CONFIRM_PEND_FOR_COMP_TRANSFER: number;
//   TOTAL_CONFIRM_TRANSFER: number;
// }

// interface MonthlyJob {
//   MONTH_NAME: string;
//   MONTH_NO: string;
//   CONFIRMED_INBOUND: number;
//   CONFIRMED_OUTBOUND: number;
//   CONFIRMED_TRANSFER?: number;
// }

// interface TopPrincipal {
//   PRIN_CODE: string;
//   TOTAL_BILL: number;
// }

// // ---------------------------------------------------------------------------
// // Helper
// // ---------------------------------------------------------------------------
// const getValue = (obj: any, key: string) => 
//   obj?.[key.toUpperCase()] ?? obj?.[key.toLowerCase()] ?? 0;

// // ---------------------------------------------------------------------------
// // Sub-components
// // ---------------------------------------------------------------------------

// function StatCard({ title, value, icon: Icon, colorClass, subtitle }: { title: string; value: string | number; icon: any; colorClass: string; subtitle?: string }) {
//   return (
//     <div className="freight-panel rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-1 transition-all duration-200 hover:shadow-md hover:border-primary/20">
//       <div className="flex items-center justify-between">
//         <span className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">{title}</span>
//         <span className={`grid h-7 w-7 place-items-center rounded-md ${colorClass}`}>
//           <Icon size={15} />
//         </span>
//       </div>
//       <div className="flex items-baseline gap-2 mt-1">
//         <span className="text-2xl font-bold text-foreground">{value}</span>
//         {subtitle && <span className="text-[10px] font-medium text-muted-foreground uppercase">{subtitle}</span>}
//       </div>
//     </div>
//   );
// }

// function BillingDonut({ inbound, outbound }: { inbound: number; outbound: number }) {
//   const data = [
//     { name: 'Inbound Billing', value: inbound, color: '#3B82F6' },
//     { name: 'Outbound Billing', value: outbound, color: '#8B5CF6' },
//   ];

//   const total = inbound + outbound;

//   return (
//     <div className="freight-panel rounded-lg border bg-card shadow-sm flex flex-col h-full">
//       <div className="border-b bg-muted/35 px-3 py-2 flex items-center gap-2 rounded-t-lg">
//         <PieChartIcon size={14} className="text-primary" />
//         <h3 className="text-[11px] font-semibold uppercase text-foreground">Billing Comparison</h3>
//       </div>
//       <div className="flex-1 p-4 flex flex-col items-center justify-center relative">
//         {total === 0 ? (
//           <div className="text-[12px] text-muted-foreground">No billing data available</div>
//         ) : (
//           <>
//             <ResponsiveContainer width="100%" height={200}>
//               <PieChart>
//                 <Pie
//                   data={data}
//                   cx="50%"
//                   cy="50%"
//                   innerRadius={60}
//                   outerRadius={80}
//                   paddingAngle={5}
//                   dataKey="value"
//                   stroke="none"
//                 >
//                   {data.map((entry, index) => (
//                     <Cell key={`cell-${index}`} fill={entry.color} />
//                   ))}
//                 </Pie>
//                 <Tooltip 
//                   formatter={(value: any) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
//                   contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
//                 />
//                 <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
//               </PieChart>
//             </ResponsiveContainer>
//             <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
//               <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total</span>
//               <div className="text-[14px] font-bold text-foreground">
//                 ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
//               </div>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }

// function TopPrincipalsList({ title, data, colorClass }: { title: string; data: TopPrincipal[]; colorClass: string }) {
//   const maxBill = Math.max(...data.map(d => d.TOTAL_BILL), 1);
  
//   return (
//     <div className="freight-panel rounded-lg border bg-card shadow-sm flex flex-col">
//       <div className="border-b bg-muted/35 px-3 py-2 flex items-center gap-2 rounded-t-lg">
//         <Users size={14} className="text-primary" />
//         <h3 className="text-[11px] font-semibold uppercase text-foreground">{title}</h3>
//       </div>
//       <div className="p-3 flex flex-col gap-3">
//         {data.length === 0 ? (
//           <div className="text-center text-[11px] text-muted-foreground py-4">No data available</div>
//         ) : (
//           data.map((item, idx) => {
//             const percentage = (item.TOTAL_BILL / maxBill) * 100;
//             return (
//               <div key={idx} className="flex flex-col gap-1">
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center gap-2">
//                     <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${colorClass}`}>
//                       {idx + 1}
//                     </span>
//                     <span className="text-[12px] font-semibold text-foreground">{item.PRIN_CODE}</span>
//                   </div>
//                   <span className="text-[12px] font-bold text-slate-700">
//                     {Number(item.TOTAL_BILL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
//                   </span>
//                 </div>
//                 <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
//                   <div 
//                     className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-primary' : 'bg-primary/60'}`} 
//                     style={{ width: `${percentage}%` }} 
//                   />
//                 </div>
//               </div>
//             );
//           })
//         )}
//       </div>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Main Dashboard Component
// // ---------------------------------------------------------------------------

// export default function WmsDashboard() {
//   const { user } = useAuth();
//   const companyCode = user?.company_code ?? "";

//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const [inbound, setInbound] = useState<InboundStats | null>(null);
//   const [outbound, setOutbound] = useState<OutboundStats | null>(null);
//   const [transfer, setTransfer] = useState<TransferStats | null>(null);
//   const [monthlyJobs, setMonthlyJobs] = useState<MonthlyJob[]>([]);
//   const [topInbound, setTopInbound] = useState<TopPrincipal[]>([]);
//   const [topOutbound, setTopOutbound] = useState<TopPrincipal[]>([]);

//   const fetchDashboardData = async () => {
//     if (!companyCode) return;
//     setLoading(true);
//     setError(null);

//     try {
//       const [
//         inboundRes, outboundRes, transferRes, monthlyRes, topInRes, topOutRes
//       ] = await Promise.all([
//         // Inbound Stats
//         executeWmsInboundSql(`
//           SELECT
//             (SELECT COUNT(*) FROM TI_JOB WHERE CANCELED <> 'Y' AND JOB_TYPE = 'IMP' AND JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TOTAL_JOBS,
//             (SELECT COUNT(*) FROM TI_JOB WHERE JOB_NO NOT IN (SELECT JOB_NO FROM TT_BATCH) AND JOB_TYPE = 'IMP' AND JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS PUTAWAY_JOB_PENDING,
//             (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED <> 'Y' AND JOB_NO IN (SELECT JOB_NO FROM TT_BATCH) AND JOB_TYPE = 'IMP' AND JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS CONFIRM_PEND_FOR_COMP_PUTAWAY,
//             (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED = 'Y' AND JOB_TYPE = 'IMP' AND JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TOTAL_CONFIRM_GRN,
//             (SELECT NVL(SUM(BILL), 0) FROM TN_INVOICE_DET WHERE JOB_TYPE = 'IMP' AND TXN_DATE >= TRUNC(SYSDATE, 'YYYY') AND TXN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TOTAL_REVENUE_INBOUND
//           FROM DUAL
//         `),
//         // Outbound Stats
//         executeWmsInboundSql(`
//           SELECT
//             (SELECT COUNT(*) FROM TI_JOB WHERE CANCELED <> 'Y' AND JOB_TYPE = 'EXP' AND JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TOTAL_JOBS,
//             (SELECT COUNT(*) FROM TI_JOB WHERE JOB_NO NOT IN (SELECT JOB_NO FROM TO_BATCH) AND JOB_TYPE = 'EXP' AND JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS PICK_JOB_PENDING,
//             (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED <> 'Y' AND JOB_NO IN (SELECT JOB_NO FROM TO_BATCH) AND JOB_TYPE = 'EXP' AND JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS CONFIRM_PEND_FOR_COMP_PICK,
//             (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED = 'Y' AND JOB_TYPE = 'EXP' AND JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TOTAL_CONFIRM_DN,
//             (SELECT NVL(SUM(BILL), 0) FROM TN_INVOICE_DET WHERE JOB_TYPE = 'EXP' AND TXN_DATE >= TRUNC(SYSDATE, 'YYYY') AND TXN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TOTAL_REVENUE_OUTBOUND
//           FROM DUAL
//         `),
//         // Transfer Stats
//         executeWmsInboundSql(`
//           SELECT
//             (SELECT COUNT(*) FROM TS_STN WHERE CANCEL <> 'Y' AND STN_DATE >= TRUNC(SYSDATE, 'YYYY') AND STN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TOTAL_TRANSFER,
//             (SELECT COUNT(*) FROM TS_STN WHERE STN_NO NOT IN (SELECT STN_NO FROM TS_BATCH) AND STN_DATE >= TRUNC(SYSDATE, 'YYYY') AND STN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TRANSFER_JOB_PENDING,
//             (SELECT COUNT(*) FROM TS_STN WHERE CONFIRMED <> 'Y' AND STN_NO IN (SELECT STN_NO FROM TS_BATCH) AND STN_DATE >= TRUNC(SYSDATE, 'YYYY') AND STN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS CONFIRM_PEND_FOR_COMP_TRANSFER,
//             (SELECT COUNT(*) FROM TS_STN WHERE CONFIRMED = 'Y' AND STN_DATE >= TRUNC(SYSDATE, 'YYYY') AND STN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)) AS TOTAL_CONFIRM_TRANSFER
//           FROM DUAL
//         `),
//         // Monthly Inbound and Outbound
//         executeWmsInboundSql(`
//           SELECT
//             TO_CHAR(JOB_DATE, 'MON') AS MONTH_NAME,
//             TO_CHAR(JOB_DATE, 'MM') AS MONTH_NO,
//             SUM(CASE WHEN JOB_TYPE = 'IMP' AND CONFIRMED = 'Y' THEN 1 ELSE 0 END) AS CONFIRMED_INBOUND,
//             SUM(CASE WHEN JOB_TYPE = 'EXP' AND CONFIRMED = 'Y' THEN 1 ELSE 0 END) AS CONFIRMED_OUTBOUND
//           FROM TI_JOB
//           WHERE JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)
//           GROUP BY TO_CHAR(JOB_DATE, 'MM'), TO_CHAR(JOB_DATE, 'MON')
//           ORDER BY MONTH_NO
//         `),
//         // Top 5 Inbound Principals
//         executeWmsInboundSql(`
//           SELECT PRIN_CODE, SUM(BILL) AS TOTAL_BILL
//           FROM TN_INVOICE_DET
//           WHERE JOB_TYPE = 'IMP' AND TXN_DATE >= TRUNC(SYSDATE, 'YYYY') AND TXN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)
//           GROUP BY PRIN_CODE ORDER BY TOTAL_BILL DESC FETCH FIRST 5 ROWS ONLY
//         `),
//         // Top 5 Outbound Principals
//         executeWmsInboundSql(`
//           SELECT PRIN_CODE, SUM(BILL) AS TOTAL_BILL
//           FROM TN_INVOICE_DET
//           WHERE JOB_TYPE = 'EXP' AND TXN_DATE >= TRUNC(SYSDATE, 'YYYY') AND TXN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)
//           GROUP BY PRIN_CODE ORDER BY TOTAL_BILL DESC FETCH FIRST 5 ROWS ONLY
//         `)
//       ]);

//       if (inboundRes?.[0]) {
//         setInbound({
//           TOTAL_JOBS: Number(getValue(inboundRes[0], "TOTAL_JOBS")),
//           PUTAWAY_JOB_PENDING: Number(getValue(inboundRes[0], "PUTAWAY_JOB_PENDING")),
//           CONFIRM_PEND_FOR_COMP_PUTAWAY: Number(getValue(inboundRes[0], "CONFIRM_PEND_FOR_COMP_PUTAWAY")),
//           TOTAL_CONFIRM_GRN: Number(getValue(inboundRes[0], "TOTAL_CONFIRM_GRN")),
//           TOTAL_REVENUE_INBOUND: Number(getValue(inboundRes[0], "TOTAL_REVENUE_INBOUND")),
//         });
//       }

//       if (outboundRes?.[0]) {
//         setOutbound({
//           TOTAL_JOBS: Number(getValue(outboundRes[0], "TOTAL_JOBS")),
//           PICK_JOB_PENDING: Number(getValue(outboundRes[0], "PICK_JOB_PENDING")),
//           CONFIRM_PEND_FOR_COMP_PICK: Number(getValue(outboundRes[0], "CONFIRM_PEND_FOR_COMP_PICK")),
//           TOTAL_CONFIRM_DN: Number(getValue(outboundRes[0], "TOTAL_CONFIRM_DN")),
//           TOTAL_REVENUE_OUTBOUND: Number(getValue(outboundRes[0], "TOTAL_REVENUE_OUTBOUND")),
//         });
//       }

//       if (transferRes?.[0]) {
//         setTransfer({
//           TOTAL_TRANSFER: Number(getValue(transferRes[0], "TOTAL_TRANSFER")),
//           TRANSFER_JOB_PENDING: Number(getValue(transferRes[0], "TRANSFER_JOB_PENDING")),
//           CONFIRM_PEND_FOR_COMP_TRANSFER: Number(getValue(transferRes[0], "CONFIRM_PEND_FOR_COMP_TRANSFER")),
//           TOTAL_CONFIRM_TRANSFER: Number(getValue(transferRes[0], "TOTAL_CONFIRM_TRANSFER")),
//         });
//       }

//       setMonthlyJobs((monthlyRes || []).map((row: any) => ({
//         MONTH_NAME: getValue(row, "MONTH_NAME"),
//         MONTH_NO: getValue(row, "MONTH_NO"),
//         CONFIRMED_INBOUND: Number(getValue(row, "CONFIRMED_INBOUND")),
//         CONFIRMED_OUTBOUND: Number(getValue(row, "CONFIRMED_OUTBOUND")),
//       })));

//       setTopInbound((topInRes || []).map((row: any) => ({
//         PRIN_CODE: getValue(row, "PRIN_CODE"),
//         TOTAL_BILL: Number(getValue(row, "TOTAL_BILL")),
//       })));

//       setTopOutbound((topOutRes || []).map((row: any) => ({
//         PRIN_CODE: getValue(row, "PRIN_CODE"),
//         TOTAL_BILL: Number(getValue(row, "TOTAL_BILL")),
//       })));

//     } catch (err) {
//       console.error("Dashboard fetch error:", err);
//       setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchDashboardData();
//   }, [companyCode]);

//   if (loading) {
//     return (
//       <div className="flex h-[80vh] items-center justify-center">
//         <div className="flex flex-col items-center gap-2 text-muted-foreground">
//           <RefreshCw className="animate-spin" size={24} />
//           <span className="text-[12px] font-medium">Loading WMS Dashboard...</span>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="freight-dense-form freight-ui-standard grid gap-4 p-4 bg-slate-50/50 min-h-screen">
      
//       {/* Header */}
//       <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
//         <div className="flex items-center gap-3">
//           <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
//             <LayoutDashboard size={20} />
//           </div>
//           <div>
//             <h1 className="m-0 text-xl font-bold leading-tight text-foreground">WMS Dashboard</h1>
//             <p className="m-0 text-[12px] text-muted-foreground">Yearly overview of warehouse operations</p>
//           </div>
//         </div>
//         <Button variant="outline" size="sm" onClick={fetchDashboardData} disabled={loading} className="h-8">
//           <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
//           Refresh Data
//         </Button>
//       </div>

//       {error && (
//         <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-700 flex items-center gap-2">
//           <AlertCircle size={14} /> {error}
//         </div>
//       )}

//       {/* KPI Grid: Inbound & Outbound */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//         <StatCard title="Inbound Jobs" value={inbound?.TOTAL_JOBS ?? 0} icon={Boxes} colorClass="bg-blue-50 text-blue-600" subtitle="Total" />
//         <StatCard title="Putaway Pending" value={inbound?.PUTAWAY_JOB_PENDING ?? 0} icon={Clock} colorClass="bg-amber-50 text-amber-600" subtitle="Action needed" />
//         <StatCard title="Confirm Pending (Putaway Done)" value={inbound?.CONFIRM_PEND_FOR_COMP_PUTAWAY ?? 0} icon={AlertCircle} colorClass="bg-orange-50 text-orange-600" subtitle="Pending GRN" />
//         <StatCard title="Confirmed GRN" value={inbound?.TOTAL_CONFIRM_GRN ?? 0} icon={CheckCircle2} colorClass="bg-emerald-50 text-emerald-600" subtitle="Completed" />
        
//         <StatCard title="Outbound Jobs" value={outbound?.TOTAL_JOBS ?? 0} icon={Truck} colorClass="bg-indigo-50 text-indigo-600" subtitle="Total" />
//         <StatCard title="Pick Pending" value={outbound?.PICK_JOB_PENDING ?? 0} icon={Clock} colorClass="bg-amber-50 text-amber-600" subtitle="Action needed" />
//         <StatCard title="Confirm Pending (Pick Done)" value={outbound?.CONFIRM_PEND_FOR_COMP_PICK ?? 0} icon={AlertCircle} colorClass="bg-orange-50 text-orange-600" subtitle="Pending DN" />
//         <StatCard title="Confirmed DN" value={outbound?.TOTAL_CONFIRM_DN ?? 0} icon={CheckCircle2} colorClass="bg-emerald-50 text-emerald-600" subtitle="Completed" />
//       </div>

//       {/* Financial & Transfer Summary */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//         <div className="lg:col-span-2 rounded-lg border bg-card shadow-sm p-5 flex items-center justify-between">
//           <div className="flex items-center gap-4">
//             <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
//               <DollarSign size={24} />
//             </div>
//             <div>
//               <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">Total Billing (Inbound)</p>
//               <p className="text-2xl font-bold text-foreground mt-1">
//                 ${(inbound?.TOTAL_REVENUE_INBOUND ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
//               </p>
//             </div>
//           </div>
//           <div className="h-12 w-px bg-border" />
//           <div className="flex items-center gap-4">
//             <div className="grid h-12 w-12 place-items-center rounded-full bg-sky-100 text-sky-600">
//               <DollarSign size={24} />
//             </div>
//             <div>
//               <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">Total Billing (Outbound)</p>
//               <p className="text-2xl font-bold text-foreground mt-1">
//                 ${(outbound?.TOTAL_REVENUE_OUTBOUND ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
//               </p>
//             </div>
//           </div>
//         </div>

//         <StatCard title="Total Transfers" value={transfer?.TOTAL_TRANSFER ?? 0} icon={ArrowRightLeft} colorClass="bg-purple-50 text-purple-600" subtitle="Stock Transfer Notes" />
//         <StatCard title="Transfer Confirmed" value={transfer?.TOTAL_CONFIRM_TRANSFER ?? 0} icon={CheckCircle2} colorClass="bg-emerald-50 text-emerald-600" subtitle="Completed" />
//       </div>

//       {/* Charts & Top Principals Grid */}
//       <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        
//         {/* Left Column: Charts */}
//         <div className="xl:col-span-2 flex flex-col gap-4">
//           {/* Grouped Bar Chart */}
//           <div className="freight-panel rounded-lg border bg-card shadow-sm flex flex-col h-[380px]">
//             <div className="border-b bg-muted/35 px-4 py-2.5 flex items-center gap-2 rounded-t-lg">
//               <BarChart3 size={15} className="text-primary" />
//               <h3 className="text-[12px] font-semibold uppercase text-foreground tracking-wide">Monthwise Confirmed Inbound & Outbound Jobs</h3>
//             </div>
//             <div className="flex-1 p-4">
//               {monthlyJobs.length === 0 ? (
//                 <div className="w-full h-full flex items-center justify-center text-[12px] text-muted-foreground">No data available</div>
//               ) : (
//                 <ResponsiveContainer width="100%" height="100%">
//                   <BarChart data={monthlyJobs} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
//                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
//                     <XAxis dataKey="MONTH_NAME" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B', fontWeight: 500 }} />
//                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
//                     <Tooltip 
//                       cursor={{ fill: '#F1F5F9' }} 
//                       contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
//                     />
//                     <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }} />
//                     <Bar dataKey="CONFIRMED_INBOUND" name="Inbound Jobs" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={24} />
//                     <Bar dataKey="CONFIRMED_OUTBOUND" name="Outbound Jobs" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={24} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               )}
//             </div>
//           </div>
          
//           {/* Area Chart for Transfers */}
//           <div className="freight-panel rounded-lg border bg-card shadow-sm flex flex-col h-[280px]">
//             <div className="border-b bg-muted/35 px-4 py-2.5 flex items-center gap-2 rounded-t-lg">
//               <ArrowRightLeft size={15} className="text-primary" />
//               <h3 className="text-[12px] font-semibold uppercase text-foreground tracking-wide">Monthwise Confirmed Transfers</h3>
//             </div>
//             <div className="flex-1 p-4">
//               {monthlyJobs.length === 0 ? (
//                 <div className="w-full h-full flex items-center justify-center text-[12px] text-muted-foreground">No data available</div>
//               ) : (
//                 <ResponsiveContainer width="100%" height="100%">
//                   <AreaChart data={monthlyJobs} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
//                     <defs>
//                       <linearGradient id="colorTransfer" x1="0" y1="0" x2="0" y2="1">
//                         <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
//                         <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
//                       </linearGradient>
//                     </defs>
//                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
//                     <XAxis dataKey="MONTH_NAME" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B', fontWeight: 500 }} />
//                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
//                     <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
//                     <Area type="monotone" dataKey="CONFIRMED_TRANSFER" name="Transfers" stroke="#A855F7" strokeWidth={2} fillOpacity={1} fill="url(#colorTransfer)" />
//                   </AreaChart>
//                 </ResponsiveContainer>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Right Column: Donut & Top 5 Principals */}
//         <div className="flex flex-col gap-4">
//           <BillingDonut 
//             inbound={inbound?.TOTAL_REVENUE_INBOUND ?? 0} 
//             outbound={outbound?.TOTAL_REVENUE_OUTBOUND ?? 0} 
//           />
//           <TopPrincipalsList 
//             title="Top 5 Principals (Inbound Billing)" 
//             data={topInbound} 
//             colorClass="bg-blue-100 text-blue-700" 
//           />
//           <TopPrincipalsList 
//             title="Top 5 Principals (Outbound Billing)" 
//             data={topOutbound} 
//             colorClass="bg-sky-100 text-sky-700" 
//           />
//         </div>
//       </div>
//     </div>
//   );
// }

// import { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   AlertCircle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CheckCircle2,
//   Hourglass, RefreshCw, Wallet2, ClipboardCheck, Layers,
// } from "lucide-react";
// import { useAuth } from "../../../state/AuthContext";
// import { executeWmsInboundSql } from "../../../api/wms";

// // ---------------------------------------------------------------------------
// // SQL (same queries you gave me; trailing ';' is stripped in runSql)
// // ---------------------------------------------------------------------------

// const YEAR_JOB = `JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)`;
// const YEAR_TXN = `TXN_DATE >= TRUNC(SYSDATE, 'YYYY') AND TXN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)`;
// const YEAR_STN = `STN_DATE >= TRUNC(SYSDATE, 'YYYY') AND STN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)`;

// const jobKpiSql = (type: "IMP" | "EXP", batchTable: "TT_BATCH" | "TO_BATCH") => `
// SELECT
//   (SELECT COUNT(*) FROM TI_JOB WHERE CANCELED <> 'Y' AND JOB_TYPE = '${type}' AND ${YEAR_JOB}) AS TOTAL_JOBS,
//   (SELECT COUNT(*) FROM TI_JOB WHERE JOB_NO NOT IN (SELECT JOB_NO FROM ${batchTable}) AND JOB_TYPE = '${type}' AND ${YEAR_JOB}) AS JOB_PENDING,
//   (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED <> 'Y' AND JOB_NO IN (SELECT JOB_NO FROM ${batchTable}) AND JOB_TYPE = '${type}' AND ${YEAR_JOB}) AS CONFIRM_PENDING,
//   (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED = 'Y' AND JOB_TYPE = '${type}' AND ${YEAR_JOB}) AS TOTAL_CONFIRMED,
//   (SELECT NVL(SUM(BILL), 0) FROM TN_INVOICE_DET WHERE JOB_TYPE = '${type}' AND ${YEAR_TXN}) AS TOTAL_REVENUE
// FROM DUAL`;

// const topPrincipalSql = (type: "IMP" | "EXP") => `
// SELECT PRIN_CODE, SUM(BILL) AS TOTAL_BILL
// FROM TN_INVOICE_DET
// WHERE JOB_TYPE = '${type}' AND ${YEAR_TXN}
// GROUP BY PRIN_CODE
// ORDER BY TOTAL_BILL DESC
// FETCH FIRST 5 ROWS ONLY`;

// const TRANSFER_KPI_SQL = `
// SELECT
//   (SELECT COUNT(*) FROM TS_STN WHERE CANCEL <> 'Y' AND ${YEAR_STN}) AS TOTAL_TRANSFER,
//   (SELECT COUNT(*) FROM TS_STN WHERE STN_NO NOT IN (SELECT STN_NO FROM TS_BATCH) AND ${YEAR_STN}) AS TRANSFER_PENDING,
//   (SELECT COUNT(*) FROM TS_STN WHERE CONFIRMED <> 'Y' AND STN_NO IN (SELECT STN_NO FROM TS_BATCH) AND ${YEAR_STN}) AS CONFIRM_PENDING,
//   (SELECT COUNT(*) FROM TS_STN WHERE CONFIRMED = 'Y' AND ${YEAR_STN}) AS TOTAL_CONFIRMED
// FROM DUAL`;

// const MONTHLY_JOBS_SQL = `
// SELECT TO_CHAR(JOB_DATE, 'MM') AS MONTH_NO,
//   SUM(CASE WHEN JOB_TYPE = 'IMP' AND CONFIRMED = 'Y' THEN 1 ELSE 0 END) AS CONFIRMED_INBOUND,
//   SUM(CASE WHEN JOB_TYPE = 'EXP' AND CONFIRMED = 'Y' THEN 1 ELSE 0 END) AS CONFIRMED_OUTBOUND
// FROM TI_JOB
// WHERE ${YEAR_JOB}
// GROUP BY TO_CHAR(JOB_DATE, 'MM')
// ORDER BY MONTH_NO`;

// // Transfers live in TS_STN (same table as the KPI query). Swap back to TI_JOB/'TRF' if that's what you really use.
// const MONTHLY_TRANSFER_SQL = `
// SELECT TO_CHAR(STN_DATE, 'MM') AS MONTH_NO, COUNT(*) AS CONFIRMED_TRANSFER
// FROM TS_STN
// WHERE CONFIRMED = 'Y' AND ${YEAR_STN}
// GROUP BY TO_CHAR(STN_DATE, 'MM')
// ORDER BY MONTH_NO`;

// // ---------------------------------------------------------------------------
// // Helpers
// // ---------------------------------------------------------------------------

// const getValue = (obj: any, key: string) => obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()];
// const num = (obj: any, key: string) => Number(getValue(obj, key) ?? 0) || 0;

// const runSql = async (sql: string): Promise<any[]> => {
//   const rows = await executeWmsInboundSql(sql.trim().replace(/;+\s*$/, ""));
//   return Array.isArray(rows) ? rows : [];
// };

// const fmtInt = (n: number) => n.toLocaleString("en-US");
// const fmtMoney = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
// const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
// const fmtCompact = (n: number) => compactFmt.format(n);
// const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// const C = {
//   inbound: "#2563EB",
//   outbound: "#F59E0B",
//   transfer: "#10B981",
//   pending: "#F59E0B",
//   awaiting: "#6366F1",
//   done: "#10B981",
// };

// const niceScale = (max: number) => {
//   const raw = Math.max(max, 1) / 4;
//   const mag = Math.pow(10, Math.floor(Math.log10(raw)));
//   const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) as number;
//   return { step, max: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
// };

// const smoothPath = (pts: Array<[number, number]>) => {
//   if (pts.length < 2) return "";
//   let d = `M${pts[0][0]},${pts[0][1]}`;
//   for (let i = 0; i < pts.length - 1; i++) {
//     const [x0, y0] = pts[i];
//     const [x1, y1] = pts[i + 1];
//     const cx = (x0 + x1) / 2;
//     d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
//   }
//   return d;
// };

// type Slice<T> = { data: T | null; error: string | null };
// type JobKpi = { total: number; pending: number; confirmPending: number; confirmed: number; revenue: number };
// type TrfKpi = { total: number; pending: number; confirmPending: number; confirmed: number };

// const toJobKpi = (rows: any[]): JobKpi => ({
//   total: num(rows[0], "total_jobs"),
//   pending: num(rows[0], "job_pending"),
//   confirmPending: num(rows[0], "confirm_pending"),
//   confirmed: num(rows[0], "total_confirmed"),
//   revenue: num(rows[0], "total_revenue"),
// });

// const toMonthly = (rows: any[], key: string) => {
//   const out = Array(12).fill(0) as number[];
//   rows.forEach((r) => {
//     const idx = Number(getValue(r, "month_no")) - 1;
//     if (idx >= 0 && idx < 12) out[idx] = num(r, key);
//   });
//   return out;
// };

// // ---------------------------------------------------------------------------
// // Shared UI
// // ---------------------------------------------------------------------------

// const card = "rounded-2xl border bg-card shadow-sm";

// function Skeleton({ className = "" }: { className?: string }) {
//   return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
// }

// function CardHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
//   return (
//     <div className="flex flex-wrap items-start justify-between gap-2">
//       <div className="min-w-0">
//         <h3 className="m-0 text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
//         {subtitle && <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>}
//       </div>
//       {right}
//     </div>
//   );
// }

// function LegendDot({ color, label, value }: { color: string; label: string; value?: string }) {
//   return (
//     <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
//       <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
//       {label}
//       {value !== undefined && <b className="font-semibold tabular-nums text-foreground">{value}</b>}
//     </span>
//   );
// }

// // Ring chart. Segments are drawn clockwise from 12 o'clock.
// function Donut({
//   segments, size = 132, thickness = 16, children,
// }: {
//   segments: Array<{ value: number; color: string }>; size?: number; thickness?: number; children?: React.ReactNode;
// }) {
//   const total = segments.reduce((s, x) => s + x.value, 0);
//   const r = (size - thickness) / 2;
//   const circ = 2 * Math.PI * r;
//   let offset = 0;
//   return (
//     <div className="relative shrink-0" style={{ width: size, height: size }}>
//       <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
//         <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-muted" />
//         {total > 0 &&
//           segments.map((s, i) => {
//             const len = (s.value / total) * circ;
//             const gap = segments.filter((x) => x.value > 0).length > 1 ? 2 : 0;
//             const el = (
//               <circle
//                 key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
//                 strokeDasharray={`${Math.max(len - gap, 0)} ${circ}`} strokeDashoffset={-offset} strokeLinecap="butt"
//               />
//             );
//             offset += len;
//             return el;
//           })}
//       </svg>
//       <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Hero
// // ---------------------------------------------------------------------------

// function HeroStat({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading: boolean }) {
//   return (
//     <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
//       <p className="m-0 text-[12px] font-medium text-white/70">{label}</p>
//       {loading ? (
//         <div className="mt-1.5 h-8 w-24 animate-pulse rounded bg-white/20" />
//       ) : (
//         <p className="m-0 mt-0.5 text-[28px] font-extrabold leading-tight tracking-tight tabular-nums">{value}</p>
//       )}
//       {sub && !loading && <p className="m-0 mt-0.5 truncate text-[11.5px] text-white/60">{sub}</p>}
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Trend chart (smooth area lines, hover tooltip, clickable legend)
// // ---------------------------------------------------------------------------

// type TrendSeries = { key: string; label: string; color: string; values: number[] };

// function TrendChart({ series, loading }: { series: TrendSeries[]; loading: boolean }) {
//   const [hidden, setHidden] = useState<Set<string>>(new Set());
//   const [hover, setHover] = useState<number | null>(null);

//   const W = 720, H = 270, L = 38, R = 14, T = 14, B = 28;
//   const pw = W - L - R, ph = H - T - B;
//   const visible = series.filter((s) => !hidden.has(s.key));
//   const scale = niceScale(Math.max(1, ...visible.flatMap((s) => s.values)));
//   const x = (i: number) => L + (i / 11) * pw;
//   const y = (v: number) => T + ph - (v / scale.max) * ph;
//   const allZero = series.every((s) => s.values.every((v) => v === 0));

//   const toggle = (k: string) =>
//     setHidden((prev) => {
//       const next = new Set(prev);
//       next.has(k) ? next.delete(k) : next.add(k);
//       return next;
//     });

//   if (loading) return <Skeleton className="mt-4 h-[270px]" />;

//   return (
//     <div>
//       <div className="mt-3 flex flex-wrap gap-2">
//         {series.map((s) => {
//           const off = hidden.has(s.key);
//           return (
//             <button
//               key={s.key} type="button" onClick={() => toggle(s.key)}
//               className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium transition ${off ? "bg-transparent text-muted-foreground opacity-60" : "bg-muted/60 text-foreground"}`}
//             >
//               <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
//               {s.label}
//               <b className="tabular-nums">{fmtInt(s.values.reduce((a, b) => a + b, 0))}</b>
//             </button>
//           );
//         })}
//       </div>

//       <div className="relative mt-3">
//         <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full text-border" onMouseLeave={() => setHover(null)}>
//           <defs>
//             {series.map((s) => (
//               <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
//                 <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
//                 <stop offset="100%" stopColor={s.color} stopOpacity="0" />
//               </linearGradient>
//             ))}
//           </defs>

//           {scale.ticks.map((t) => (
//             <g key={t}>
//               <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
//               <text x={L - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
//             </g>
//           ))}
//           {MONTHS.map((m, i) => (
//             <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" className={i === hover ? "fill-foreground font-semibold" : "fill-muted-foreground"}>{m}</text>
//           ))}

//           {visible.map((s) => {
//             const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
//             const line = smoothPath(pts);
//             return (
//               <g key={s.key}>
//                 <path d={`${line} L${x(11)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#trend-${s.key})`} />
//                 <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
//               </g>
//             );
//           })}

//           {hover !== null && (
//             <g>
//               <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground" />
//               {visible.map((s) => (
//                 <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill="white" stroke={s.color} strokeWidth="2.5" />
//               ))}
//             </g>
//           )}

//           <rect
//             x={L} y={T} width={pw} height={ph} fill="transparent"
//             onMouseMove={(e) => {
//               const box = e.currentTarget.getBoundingClientRect();
//               const ratio = (e.clientX - box.left) / box.width;
//               setHover(Math.min(11, Math.max(0, Math.round(ratio * 11))));
//             }}
//           />
//         </svg>

//         {hover !== null && (
//           <div
//             className="pointer-events-none absolute top-1 z-10 min-w-[128px] rounded-xl border bg-popover px-3 py-2 text-[12px] shadow-lg"
//             style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%`, transform: "translateX(-50%)" }}
//           >
//             <p className="m-0 mb-1 font-bold text-foreground">{MONTHS[hover]}</p>
//             {visible.map((s) => (
//               <div key={s.key} className="flex items-center justify-between gap-4">
//                 <span className="inline-flex items-center gap-1.5 text-muted-foreground">
//                   <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}
//                 </span>
//                 <b className="tabular-nums text-foreground">{fmtInt(s.values[hover])}</b>
//               </div>
//             ))}
//           </div>
//         )}

//         {allZero && (
//           <div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted-foreground">No confirmed activity this year yet.</div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Grouped bars: inbound vs outbound vs transfer, per stage
// // ---------------------------------------------------------------------------

// function StageBars({
//   groups, loading,
// }: {
//   groups: Array<{ label: string; values: [number, number, number] }>; loading: boolean;
// }) {
//   const W = 520, H = 250, L = 34, R = 8, T = 22, B = 30;
//   const pw = W - L - R, ph = H - T - B;
//   const scale = niceScale(Math.max(1, ...groups.flatMap((g) => g.values)));
//   const y = (v: number) => T + ph - (v / scale.max) * ph;
//   const colors = [C.inbound, C.outbound, C.transfer];
//   const gw = pw / groups.length;
//   const bw = 30, gap = 6;

//   if (loading) return <Skeleton className="mt-4 h-[250px]" />;

//   return (
//     <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full text-border">
//       {scale.ticks.map((t) => (
//         <g key={t}>
//           <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
//           <text x={L - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
//         </g>
//       ))}
//       {groups.map((g, gi) => {
//         const start = L + gi * gw + (gw - (3 * bw + 2 * gap)) / 2;
//         return (
//           <g key={g.label}>
//             {g.values.map((v, si) => {
//               const bx = start + si * (bw + gap);
//               const h = Math.max(y(0) - y(v), v > 0 ? 3 : 0);
//               return (
//                 <g key={si}>
//                   <rect x={bx} y={y(0) - h} width={bw} height={h} rx="6" fill={colors[si]}>
//                     <title>{`${g.label}: ${fmtInt(v)}`}</title>
//                   </rect>
//                   <text x={bx + bw / 2} y={y(0) - h - 6} textAnchor="middle" fontSize="10.5" fontWeight="600" className="fill-foreground tabular-nums">{fmtInt(v)}</text>
//                 </g>
//               );
//             })}
//             <text x={L + gi * gw + gw / 2} y={H - 9} textAnchor="middle" fontSize="11.5" className="fill-muted-foreground">{g.label}</text>
//           </g>
//         );
//       })}
//     </svg>
//   );
// }

// // ---------------------------------------------------------------------------
// // Flow card (Inbound / Outbound / Transfer)
// // ---------------------------------------------------------------------------

// function FlowCard({
//   title, icon: Icon, color, data, stageLabels, revenue, loading,
// }: {
//   title: string; icon: typeof Layers; color: string; data: Omit<JobKpi, "revenue"> | null;
//   stageLabels: [string, string, string]; revenue?: number; loading: boolean;
// }) {
//   const d = data ?? { total: 0, pending: 0, confirmPending: 0, confirmed: 0 };
//   const stageTotal = d.pending + d.confirmPending + d.confirmed;
//   const rows: Array<[string, number, string]> = [
//     [stageLabels[0], d.pending, C.pending],
//     [stageLabels[1], d.confirmPending, C.awaiting],
//     [stageLabels[2], d.confirmed, C.done],
//   ];

//   return (
//     <section className={`${card} flex flex-col gap-4 p-4`}>
//       <div className="flex items-center gap-3">
//         <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: color }}>
//           <Icon size={19} />
//         </div>
//         <div className="min-w-0">
//           <h3 className="m-0 text-[15px] font-bold tracking-tight text-foreground">{title}</h3>
//           <p className="m-0 text-[12px] text-muted-foreground">This year</p>
//         </div>
//         <div className="ml-auto text-right">
//           {loading && !data ? <Skeleton className="h-8 w-14" /> : (
//             <p className="m-0 text-[30px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{fmtInt(d.total)}</p>
//           )}
//           <p className="m-0 mt-1 text-[11.5px] text-muted-foreground">total jobs</p>
//         </div>
//       </div>

//       <div className="flex items-center gap-4">
//         <Donut segments={rows.map(([, v, c]) => ({ value: v, color: c }))} size={118} thickness={15}>
//           <div>
//             <p className="m-0 text-[22px] font-extrabold leading-none tabular-nums text-foreground">{pct(d.confirmed, stageTotal)}%</p>
//             <p className="m-0 mt-0.5 text-[10.5px] text-muted-foreground">confirmed</p>
//           </div>
//         </Donut>
//         <ul className="m-0 grid min-w-0 flex-1 list-none gap-2.5 p-0">
//           {rows.map(([label, value, c]) => (
//             <li key={label} className="flex items-center justify-between gap-2 text-[12.5px]">
//               <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
//                 <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />
//                 <span className="truncate">{label}</span>
//               </span>
//               <b className="font-bold tabular-nums text-foreground">{fmtInt(value)}</b>
//             </li>
//           ))}
//         </ul>
//       </div>

//       {revenue !== undefined && (
//         <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
//           <span className="inline-flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
//             <Wallet2 size={14} /> Billing
//           </span>
//           <b className="text-[14px] font-bold tabular-nums text-foreground">{fmtMoney(revenue)}</b>
//         </div>
//       )}
//     </section>
//   );
// }

// // ---------------------------------------------------------------------------
// // Top principals with Inbound / Outbound switch
// // ---------------------------------------------------------------------------

// function PrincipalsCard({
//   inbound, outbound, loading,
// }: {
//   inbound: Slice<any[]>; outbound: Slice<any[]>; loading: boolean;
// }) {
//   const [tab, setTab] = useState<"in" | "out">("in");
//   const slice = tab === "in" ? inbound : outbound;
//   const color = tab === "in" ? C.inbound : C.outbound;
//   const rows = slice.data ?? [];
//   const top = Math.max(1, ...rows.map((r) => num(r, "total_bill")));
//   const sum = rows.reduce((s, r) => s + num(r, "total_bill"), 0);

//   return (
//     <section className={`${card} p-4`}>
//       <CardHead
//         title="Top 5 principals"
//         subtitle="Ranked by billing this year"
//         right={
//           <div className="inline-flex rounded-full bg-muted p-0.5 text-[12px] font-semibold">
//             {(["in", "out"] as const).map((t) => (
//               <button
//                 key={t} type="button" onClick={() => setTab(t)}
//                 className={`rounded-full px-3 py-1 transition ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
//               >
//                 {t === "in" ? "Inbound" : "Outbound"}
//               </button>
//             ))}
//           </div>
//         }
//       />
//       <div className="mt-4">
//         {slice.error ? (
//           <ErrorLine text={slice.error} />
//         ) : loading && !slice.data ? (
//           <div className="grid gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div>
//         ) : rows.length === 0 ? (
//           <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">No billing recorded this year.</p>
//         ) : (
//           <ol className="m-0 grid list-none gap-3.5 p-0">
//             {rows.map((r, i) => {
//               const bill = num(r, "total_bill");
//               return (
//                 <li key={`${getValue(r, "prin_code")}-${i}`} className="grid gap-1.5">
//                   <div className="flex items-center justify-between gap-3">
//                     <span className="flex min-w-0 items-center gap-2.5">
//                       <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: color, opacity: 1 - i * 0.14 }}>{i + 1}</span>
//                       <span className="truncate text-[13px] font-semibold text-foreground">{getValue(r, "prin_code")}</span>
//                     </span>
//                     <span className="shrink-0 text-right">
//                       <b className="text-[13px] font-bold tabular-nums text-foreground">{fmtMoney(bill)}</b>
//                       <span className="ml-2 text-[11.5px] tabular-nums text-muted-foreground">{pct(bill, sum)}%</span>
//                     </span>
//                   </div>
//                   <div className="h-2 overflow-hidden rounded-full bg-muted">
//                     <div className="h-full rounded-full" style={{ width: `${(bill / top) * 100}%`, background: color, opacity: 1 - i * 0.12 }} />
//                   </div>
//                 </li>
//               );
//             })}
//           </ol>
//         )}
//       </div>
//     </section>
//   );
// }

// function ErrorLine({ text }: { text: string }) {
//   return (
//     <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
//       <AlertCircle size={14} /> {text}
//     </div>
//   );
// }

// // ---------------------------------------------------------------------------
// // Main
// // ---------------------------------------------------------------------------

// export default function WmsDashboard() {
//   const { user } = useAuth();
//   const [loading, setLoading] = useState(true);
//   const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

//   const [inKpi, setInKpi] = useState<Slice<JobKpi>>({ data: null, error: null });
//   const [inTop, setInTop] = useState<Slice<any[]>>({ data: null, error: null });
//   const [outKpi, setOutKpi] = useState<Slice<JobKpi>>({ data: null, error: null });
//   const [outTop, setOutTop] = useState<Slice<any[]>>({ data: null, error: null });
//   const [trfKpi, setTrfKpi] = useState<Slice<TrfKpi>>({ data: null, error: null });
//   const [jobsMonthly, setJobsMonthly] = useState<Slice<{ inb: number[]; out: number[] }>>({ data: null, error: null });
//   const [trfMonthly, setTrfMonthly] = useState<Slice<number[]>>({ data: null, error: null });

//   // Optional font: loads Plus Jakarta Sans once, falls back to Inter/system if offline
//   useEffect(() => {
//     const id = "wms-dashboard-font";
//     if (document.getElementById(id)) return;
//     const link = document.createElement("link");
//     link.id = id;
//     link.rel = "stylesheet";
//     link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
//     document.head.appendChild(link);
//   }, []);

//   const load = useCallback(async () => {
//     setLoading(true);
//     const wrap = async <T,>(sql: string, map: (rows: any[]) => T, set: (s: Slice<T>) => void) => {
//       try {
//         set({ data: map(await runSql(sql)), error: null });
//       } catch (e) {
//         set({ data: null, error: e instanceof Error ? e.message : "Failed to load data." });
//       }
//     };
//     await Promise.all([
//       wrap(jobKpiSql("IMP", "TT_BATCH"), toJobKpi, setInKpi),
//       wrap(topPrincipalSql("IMP"), (r) => r, setInTop),
//       wrap(jobKpiSql("EXP", "TO_BATCH"), toJobKpi, setOutKpi),
//       wrap(topPrincipalSql("EXP"), (r) => r, setOutTop),
//       wrap(TRANSFER_KPI_SQL, (r): TrfKpi => ({
//         total: num(r[0], "total_transfer"), pending: num(r[0], "transfer_pending"),
//         confirmPending: num(r[0], "confirm_pending"), confirmed: num(r[0], "total_confirmed"),
//       }), setTrfKpi),
//       wrap(MONTHLY_JOBS_SQL, (r) => ({ inb: toMonthly(r, "confirmed_inbound"), out: toMonthly(r, "confirmed_outbound") }), setJobsMonthly),
//       wrap(MONTHLY_TRANSFER_SQL, (r) => toMonthly(r, "confirmed_transfer"), setTrfMonthly),
//     ]);
//     setUpdatedAt(new Date());
//     setLoading(false);
//   }, []);

//   useEffect(() => { if (user?.company_code) load(); }, [user?.company_code, load]);

//   const year = new Date().getFullYear();
//   const zeros = useMemo(() => Array(12).fill(0) as number[], []);

//   const inD = inKpi.data, outD = outKpi.data, trfD = trfKpi.data;

//   const hero = useMemo(() => {
//     const billing = (inD?.revenue ?? 0) + (outD?.revenue ?? 0);
//     const jobs = (inD?.total ?? 0) + (outD?.total ?? 0) + (trfD?.total ?? 0);
//     const confirmed = (inD?.confirmed ?? 0) + (outD?.confirmed ?? 0) + (trfD?.confirmed ?? 0);
//     const open =
//       (inD?.pending ?? 0) + (inD?.confirmPending ?? 0) +
//       (outD?.pending ?? 0) + (outD?.confirmPending ?? 0) +
//       (trfD?.pending ?? 0) + (trfD?.confirmPending ?? 0);
//     return { billing, jobs, confirmed, open, rate: Math.min(100, pct(confirmed, confirmed + open)) };
//   }, [inD, outD, trfD]);

//   const trendSeries = useMemo<TrendSeries[]>(() => [
//     { key: "inbound", label: "Inbound", color: C.inbound, values: jobsMonthly.data?.inb ?? zeros },
//     { key: "outbound", label: "Outbound", color: C.outbound, values: jobsMonthly.data?.out ?? zeros },
//     { key: "transfer", label: "Transfer", color: C.transfer, values: trfMonthly.data ?? zeros },
//   ], [jobsMonthly.data, trfMonthly.data, zeros]);

//   const stageGroups = useMemo(() => [
//     { label: "Pending", values: [inD?.pending ?? 0, outD?.pending ?? 0, trfD?.pending ?? 0] as [number, number, number] },
//     { label: "Awaiting confirm", values: [inD?.confirmPending ?? 0, outD?.confirmPending ?? 0, trfD?.confirmPending ?? 0] as [number, number, number] },
//     { label: "Confirmed", values: [inD?.confirmed ?? 0, outD?.confirmed ?? 0, trfD?.confirmed ?? 0] as [number, number, number] },
//   ], [inD, outD, trfD]);

//   const inRev = inD?.revenue ?? 0;
//   const outRev = outD?.revenue ?? 0;
//   const revTotal = inRev + outRev;

//   const errors = [inKpi, inTop, outKpi, outTop, trfKpi, jobsMonthly, trfMonthly].filter((s) => s.error);
//   const busyFirst = loading && !updatedAt;

//   return (
//     <div className="grid gap-4" style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}>
//       {/* Hero */}
//       <section
//         className="relative overflow-hidden rounded-2xl p-5 text-white shadow-md sm:p-6"
//         style={{ background: "linear-gradient(118deg, #00246B 0%, #00378C 48%, #1467D6 100%)" }}
//       >
//         <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
//         <div className="relative flex flex-wrap items-start justify-between gap-3">
//           <div>
//             <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-tight">Warehouse overview</h1>
//             <p className="m-0 mt-1 text-[13px] text-white/70">
//               Year to date, 1 Jan {year} to today
//               {updatedAt ? `. Updated ${updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
//             </p>
//           </div>
//           <button
//             type="button" onClick={load} disabled={loading}
//             className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-white/25 disabled:opacity-60"
//           >
//             <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
//           </button>
//         </div>

//         <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
//           <HeroStat label="Total billing" value={fmtCompact(hero.billing)} sub={`Inbound ${fmtCompact(inRev)}, outbound ${fmtCompact(outRev)}`} loading={busyFirst} />
//           <HeroStat label="Total jobs" value={fmtInt(hero.jobs)} sub={`${fmtInt(inD?.total ?? 0)} in, ${fmtInt(outD?.total ?? 0)} out, ${fmtInt(trfD?.total ?? 0)} transfer`} loading={busyFirst} />
//           <HeroStat label="Confirmed" value={fmtInt(hero.confirmed)} sub={`${hero.rate}% of all handled work`} loading={busyFirst} />
//           <HeroStat label="Needs action" value={fmtInt(hero.open)} sub="Pending plus awaiting confirmation" loading={busyFirst} />
//         </div>
//       </section>

//       {errors.length > 0 && (
//         <ErrorLine text={`${errors.length} of 7 queries failed. First error: ${errors[0].error}`} />
//       )}

//       {/* Trend + revenue split */}
//       <div className="grid gap-4 lg:grid-cols-12">
//         <section className={`${card} p-4 lg:col-span-8`}>
//           <CardHead title="Confirmed jobs by month" subtitle="Compare inbound, outbound and transfer. Click a legend chip to hide a line." />
//           <TrendChart series={trendSeries} loading={busyFirst} />
//         </section>

//         <section className={`${card} flex flex-col p-4 lg:col-span-4`}>
//           <CardHead title="Billing split" subtitle="Inbound vs outbound revenue" />
//           <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4">
//             {busyFirst ? <Skeleton className="h-[176px] w-[176px] rounded-full" /> : (
//               <Donut size={176} thickness={20} segments={[{ value: inRev, color: C.inbound }, { value: outRev, color: C.outbound }]}>
//                 <div>
//                   <p className="m-0 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{fmtCompact(revTotal)}</p>
//                   <p className="m-0 mt-1 text-[11.5px] text-muted-foreground">total billing</p>
//                 </div>
//               </Donut>
//             )}
//             <div className="grid w-full gap-2">
//               {[
//                 ["Inbound", inRev, C.inbound],
//                 ["Outbound", outRev, C.outbound],
//               ].map(([label, value, color]) => (
//                 <div key={label as string} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
//                   <LegendDot color={color as string} label={label as string} />
//                   <span className="text-right">
//                     <b className="text-[13px] font-bold tabular-nums text-foreground">{fmtMoney(value as number)}</b>
//                     <span className="ml-2 text-[11.5px] tabular-nums text-muted-foreground">{pct(value as number, revTotal)}%</span>
//                   </span>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </section>
//       </div>

//       {/* Flow cards */}
//       <div className="grid gap-4 lg:grid-cols-3">
//         <FlowCard
//           title="Inbound" icon={ArrowDownToLine} color={C.inbound} data={inD} revenue={inRev} loading={loading}
//           stageLabels={["Putaway pending", "Putaway done, confirm pending", "GRN confirmed"]}
//         />
//         <FlowCard
//           title="Outbound" icon={ArrowUpFromLine} color={C.outbound} data={outD} revenue={outRev} loading={loading}
//           stageLabels={["Pick pending", "Pick done, confirm pending", "Delivery confirmed"]}
//         />
//         <FlowCard
//           title="Transfer" icon={ArrowLeftRight} color={C.transfer} data={trfD} loading={loading}
//           stageLabels={["Transfer pending", "Transfer done, confirm pending", "Transfer confirmed"]}
//         />
//       </div>

//       {/* Stage comparison + principals */}
//       <div className="grid gap-4 lg:grid-cols-2">
//         <section className={`${card} p-4`}>
//           <CardHead
//             title="Workload by stage"
//             subtitle="Where each flow stands right now"
//             right={
//               <div className="flex flex-wrap gap-3">
//                 <LegendDot color={C.inbound} label="Inbound" />
//                 <LegendDot color={C.outbound} label="Outbound" />
//                 <LegendDot color={C.transfer} label="Transfer" />
//               </div>
//             }
//           />
//           <StageBars groups={stageGroups} loading={busyFirst} />
//           <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
//             <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-muted-foreground">
//               <Hourglass size={14} style={{ color: C.pending }} />
//               Pending <b className="ml-auto tabular-nums text-foreground">{fmtInt(stageGroups[0].values.reduce((a, b) => a + b, 0))}</b>
//             </div>
//             <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-muted-foreground">
//               <ClipboardCheck size={14} style={{ color: C.awaiting }} />
//               Awaiting confirm <b className="ml-auto tabular-nums text-foreground">{fmtInt(stageGroups[1].values.reduce((a, b) => a + b, 0))}</b>
//             </div>
//           </div>
//         </section>

//         <PrincipalsCard inbound={inTop} outbound={outTop} loading={loading} />
//       </div>

//       <p className="m-0 flex items-center justify-center gap-1.5 pb-1 text-[11.5px] text-muted-foreground">
//         <CheckCircle2 size={12} /> Numbers cover the current calendar year only.
//       </p>
//     </div>
//   );
// }


import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, RefreshCw, Wallet2, Layers,
} from "lucide-react";
import { useAuth } from "../../../state/AuthContext";
import { executeWmsInboundSql } from "../../../api/wms";
import { getPrincipalDropdown } from "../../../api/billing";

// ---------------------------------------------------------------------------
// SQL (same queries you gave me; trailing ';' is stripped in runSql)
// ---------------------------------------------------------------------------

const YEAR_JOB = `JOB_DATE >= TRUNC(SYSDATE, 'YYYY') AND JOB_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)`;
const YEAR_TXN = `TXN_DATE >= TRUNC(SYSDATE, 'YYYY') AND TXN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)`;
const YEAR_STN = `STN_DATE >= TRUNC(SYSDATE, 'YYYY') AND STN_DATE < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12)`;

const jobKpiSql = (type: "IMP" | "EXP", batchTable: "TT_BATCH" | "TO_BATCH") => `
SELECT
  (SELECT COUNT(*) FROM TI_JOB WHERE CANCELED <> 'Y' AND JOB_TYPE = '${type}' AND ${YEAR_JOB}) AS TOTAL_JOBS,
  (SELECT COUNT(*) FROM TI_JOB WHERE JOB_NO NOT IN (SELECT JOB_NO FROM ${batchTable}) AND JOB_TYPE = '${type}' AND ${YEAR_JOB}) AS JOB_PENDING,
  (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED <> 'Y' AND JOB_NO IN (SELECT JOB_NO FROM ${batchTable}) AND JOB_TYPE = '${type}' AND ${YEAR_JOB}) AS CONFIRM_PENDING,
  (SELECT COUNT(*) FROM TI_JOB WHERE CONFIRMED = 'Y' AND JOB_TYPE = '${type}' AND ${YEAR_JOB}) AS TOTAL_CONFIRMED,
  (SELECT NVL(SUM(BILL), 0) FROM TN_INVOICE_DET WHERE JOB_TYPE = '${type}' AND ${YEAR_TXN}) AS TOTAL_REVENUE
FROM DUAL`;

const topPrincipalSql = (type: "IMP" | "EXP") => `
SELECT PRIN_CODE, SUM(BILL) AS TOTAL_BILL
FROM TN_INVOICE_DET
WHERE JOB_TYPE = '${type}' AND ${YEAR_TXN}
GROUP BY PRIN_CODE
ORDER BY TOTAL_BILL DESC
FETCH FIRST 5 ROWS ONLY`;

const TRANSFER_KPI_SQL = `
SELECT
  (SELECT COUNT(*) FROM TS_STN WHERE CANCEL <> 'Y' AND ${YEAR_STN}) AS TOTAL_TRANSFER,
  (SELECT COUNT(*) FROM TS_STN WHERE STN_NO NOT IN (SELECT STN_NO FROM TS_BATCH) AND ${YEAR_STN}) AS TRANSFER_PENDING,
  (SELECT COUNT(*) FROM TS_STN WHERE CONFIRMED <> 'Y' AND STN_NO IN (SELECT STN_NO FROM TS_BATCH) AND ${YEAR_STN}) AS CONFIRM_PENDING,
  (SELECT COUNT(*) FROM TS_STN WHERE CONFIRMED = 'Y' AND ${YEAR_STN}) AS TOTAL_CONFIRMED
FROM DUAL`;

const MONTHLY_JOBS_SQL = `
SELECT TO_CHAR(JOB_DATE, 'MM') AS MONTH_NO,
  SUM(CASE WHEN JOB_TYPE = 'IMP' AND CONFIRMED = 'Y' THEN 1 ELSE 0 END) AS CONFIRMED_INBOUND,
  SUM(CASE WHEN JOB_TYPE = 'EXP' AND CONFIRMED = 'Y' THEN 1 ELSE 0 END) AS CONFIRMED_OUTBOUND
FROM TI_JOB
WHERE ${YEAR_JOB}
GROUP BY TO_CHAR(JOB_DATE, 'MM')
ORDER BY MONTH_NO`;

// Transfers live in TS_STN (same table as the KPI query). Swap back to TI_JOB/'TRF' if that's what you really use.
const MONTHLY_TRANSFER_SQL = `
SELECT TO_CHAR(STN_DATE, 'MM') AS MONTH_NO, COUNT(*) AS CONFIRMED_TRANSFER
FROM TS_STN
WHERE CONFIRMED = 'Y' AND ${YEAR_STN}
GROUP BY TO_CHAR(STN_DATE, 'MM')
ORDER BY MONTH_NO`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getValue = (obj: any, key: string) => obj?.[key.toLowerCase()] ?? obj?.[key.toUpperCase()];
const num = (obj: any, key: string) => Number(getValue(obj, key) ?? 0) || 0;

const runSql = async (sql: string): Promise<any[]> => {
  const rows = await executeWmsInboundSql(sql.trim().replace(/;+\s*$/, ""));
  return Array.isArray(rows) ? rows : [];
};

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtMoney = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const fmtCompact = (n: number) => compactFmt.format(n);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const C = {
  inbound: "#2563EB",
  outbound: "#F59E0B",
  transfer: "#10B981",
  pending: "#F59E0B",
  awaiting: "#6366F1",
  done: "#10B981",
};

const niceScale = (max: number) => {
  const raw = Math.max(max, 1) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) as number;
  return { step, max: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
};

const smoothPath = (pts: Array<[number, number]>) => {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
};

type Slice<T> = { data: T | null; error: string | null };
type JobKpi = { total: number; pending: number; confirmPending: number; confirmed: number; revenue: number };
type TrfKpi = { total: number; pending: number; confirmPending: number; confirmed: number };

const toJobKpi = (rows: any[]): JobKpi => ({
  total: num(rows[0], "total_jobs"),
  pending: num(rows[0], "job_pending"),
  confirmPending: num(rows[0], "confirm_pending"),
  confirmed: num(rows[0], "total_confirmed"),
  revenue: num(rows[0], "total_revenue"),
});

const toMonthly = (rows: any[], key: string) => {
  const out = Array(12).fill(0) as number[];
  rows.forEach((r) => {
    const idx = Number(getValue(r, "month_no")) - 1;
    if (idx >= 0 && idx < 12) out[idx] = num(r, key);
  });
  return out;
};

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

const card = "rounded-2xl border bg-card shadow-sm";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function CardHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
      <div className="min-w-0">
        <h3 className="m-0 text-[14px] font-bold leading-tight tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="m-0 mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
      <AlertCircle size={14} /> {text}
    </div>
  );
}

// Ring chart. Segments are drawn clockwise from 12 o'clock.
function Donut({
  segments, size = 132, thickness = 16, children,
}: {
  segments: Array<{ value: number; color: string }>; size?: number; thickness?: number; children?: React.ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-muted" />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * circ;
            const gap = segments.filter((x) => x.value > 0).length > 1 ? 2 : 0;
            const el = (
              <circle
                key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
                strokeDasharray={`${Math.max(len - gap, 0)} ${circ}`} strokeDashoffset={-offset} strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero stat
// ---------------------------------------------------------------------------

function HeroStat({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading: boolean }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
      <p className="m-0 text-[11.5px] font-medium text-white/70">{label}</p>
      {loading ? (
        <div className="mt-1 h-6 w-20 animate-pulse rounded bg-white/20" />
      ) : (
        <p className="m-0 text-[22px] font-extrabold leading-tight tracking-tight tabular-nums">{value}</p>
      )}
      {sub && !loading && <p className="m-0 truncate text-[11px] text-white/60">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend chart (smooth area lines, hover tooltip, clickable legend)
// ---------------------------------------------------------------------------

type TrendSeries = { key: string; label: string; color: string; values: number[] };

function TrendChart({ series, loading }: { series: TrendSeries[]; loading: boolean }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);

  const W = 730, H = 220, L = 34, R = 12, T = 12, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const visible = series.filter((s) => !hidden.has(s.key));
  const scale = niceScale(Math.max(1, ...visible.flatMap((s) => s.values)));
  const x = (i: number) => L + (i / 11) * pw;
  const y = (v: number) => T + ph - (v / scale.max) * ph;
  const allZero = series.every((s) => s.values.every((v) => v === 0));

  const toggle = (k: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  if (loading) return <Skeleton className="mt-3 h-[220px]" />;

  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key} type="button" onClick={() => toggle(s.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition ${off ? "bg-transparent text-muted-foreground opacity-60" : "bg-muted/60 text-foreground"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
              <b className="tabular-nums">{fmtInt(s.values.reduce((a, b) => a + b, 0))}</b>
            </button>
          );
        })}
      </div>

      <div className="relative mt-1.5">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full text-border" onMouseLeave={() => setHover(null)}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={L - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
            </g>
          ))}
          {MONTHS.map((m, i) => (
            <text key={m} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10.5" className={i === hover ? "fill-foreground font-semibold" : "fill-muted-foreground"}>{m}</text>
          ))}

          {visible.map((s) => {
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const line = smoothPath(pts);
            return (
              <g key={s.key}>
                <path d={`${line} L${x(11)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#trend-${s.key})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" />
              </g>
            );
          })}

          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground" />
              {visible.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill="white" stroke={s.color} strokeWidth="2.5" />
              ))}
            </g>
          )}

          <rect
            x={L} y={T} width={pw} height={ph} fill="transparent"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - box.left) / box.width;
              setHover(Math.min(11, Math.max(0, Math.round(ratio * 11))));
            }}
          />
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[128px] rounded-xl border bg-popover px-3 py-2 text-[12px] shadow-lg"
            style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%`, transform: "translateX(-50%)" }}
          >
            <p className="m-0 mb-1 font-bold text-foreground">{MONTHS[hover]}</p>
            {visible.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}
                </span>
                <b className="tabular-nums text-foreground">{fmtInt(s.values[hover])}</b>
              </div>
            ))}
          </div>
        )}

        {allZero && (
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-muted-foreground">No confirmed activity this year yet.</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped bars: inbound vs outbound vs transfer, per stage
// ---------------------------------------------------------------------------

function StageBars({
  groups, loading,
}: {
  groups: Array<{ label: string; values: [number, number, number] }>; loading: boolean;
}) {
  const W = 340, H = 220, L = 30, R = 6, T = 20, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const scale = niceScale(Math.max(1, ...groups.flatMap((g) => g.values)));
  const y = (v: number) => T + ph - (v / scale.max) * ph;
  const colors = [C.inbound, C.outbound, C.transfer];
  const gw = pw / groups.length;
  const bw = 22, gap = 4;

  if (loading) return <Skeleton className="mt-3 h-[220px]" />;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 block h-auto w-full text-border">
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeDasharray={t === 0 ? undefined : "3 4"} />
          <text x={L - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" className="fill-muted-foreground tabular-nums">{fmtCompact(t)}</text>
        </g>
      ))}
      {groups.map((g, gi) => {
        const start = L + gi * gw + (gw - (3 * bw + 2 * gap)) / 2;
        return (
          <g key={g.label}>
            {g.values.map((v, si) => {
              const bx = start + si * (bw + gap);
              const h = Math.max(y(0) - y(v), v > 0 ? 3 : 0);
              return (
                <g key={si}>
                  <rect x={bx} y={y(0) - h} width={bw} height={h} rx="5" fill={colors[si]}>
                    <title>{`${g.label}: ${fmtInt(v)}`}</title>
                  </rect>
                  <text x={bx + bw / 2} y={y(0) - h - 5} textAnchor="middle" fontSize="10" fontWeight="600" className="fill-foreground tabular-nums">{fmtInt(v)}</text>
                </g>
              );
            })}
            <text x={L + gi * gw + gw / 2} y={H - 7} textAnchor="middle" fontSize="11" className="fill-muted-foreground">{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Flow card (Inbound / Outbound / Transfer) - compact
// ---------------------------------------------------------------------------

function FlowCard({
  title, icon: Icon, color, data, stageLabels, footer, loading,
}: {
  title: string; icon: typeof Layers; color: string; data: Omit<JobKpi, "revenue"> | null;
  stageLabels: [string, string, string]; footer: { label: string; value: string; icon: typeof Layers }; loading: boolean;
}) {
  const d = data ?? { total: 0, pending: 0, confirmPending: 0, confirmed: 0 };
  const stageTotal = d.pending + d.confirmPending + d.confirmed;
  const FooterIcon = footer.icon;
  const rows: Array<[string, number, string]> = [
    [stageLabels[0], d.pending, C.pending],
    [stageLabels[1], d.confirmPending, C.awaiting],
    [stageLabels[2], d.confirmed, C.done],
  ];

  return (
    <section className={`${card} flex min-w-0 flex-col gap-3 overflow-hidden p-3.5`}>
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}>
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-[14px] font-bold leading-tight tracking-tight text-foreground">{title}</h3>
          <p className="m-0 text-[11.5px] text-muted-foreground">This year</p>
        </div>
        <div className="ml-auto text-right">
          {loading && !data ? <Skeleton className="h-7 w-12" /> : (
            <p className="m-0 text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{fmtInt(d.total)}</p>
          )}
          <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">total jobs</p>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <Donut segments={rows.map(([, v, c]) => ({ value: v, color: c }))} size={92} thickness={12}>
          <div>
            <p className="m-0 text-[17px] font-extrabold leading-none tabular-nums text-foreground">{pct(d.confirmed, stageTotal)}%</p>
            <p className="m-0 mt-0.5 text-[10px] text-muted-foreground">confirmed</p>
          </div>
        </Donut>
        <ul className="m-0 grid min-w-0 flex-1 list-none gap-2 p-0">
          {rows.map(([label, value, c]) => (
            <li key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />
                <span className="truncate">{label}</span>
              </span>
              <b className="font-bold tabular-nums text-foreground">{fmtInt(value)}</b>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          <FooterIcon size={13} /> {footer.label}
        </span>
        <b className="text-[13px] font-bold tabular-nums text-foreground">{footer.value}</b>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Top principals with Inbound / Outbound switch
// ---------------------------------------------------------------------------

function PrincipalsCard({
  inbound, outbound, names, loading,
}: {
  inbound: Slice<any[]>; outbound: Slice<any[]>; names: Record<string, string>; loading: boolean;
}) {
  const [tab, setTab] = useState<"in" | "out">("in");
  const slice = tab === "in" ? inbound : outbound;
  const color = tab === "in" ? C.inbound : C.outbound;
  const rows = slice.data ?? [];
  const top = Math.max(1, ...rows.map((r) => num(r, "total_bill")));
  const sum = rows.reduce((s, r) => s + num(r, "total_bill"), 0);

  return (
    <section className={`${card} min-w-0 overflow-hidden p-3.5`}>
      <CardHead
        title="Top 5 principals"
        subtitle="By billing this year"
        right={
          <div className="inline-flex rounded-full bg-muted p-0.5 text-[11.5px] font-semibold">
            {(["in", "out"] as const).map((t) => (
              <button
                key={t} type="button" onClick={() => setTab(t)}
                className={`rounded-full px-2.5 py-0.5 transition ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {t === "in" ? "Inbound" : "Outbound"}
              </button>
            ))}
          </div>
        }
      />
      <div className="mt-3">
        {slice.error ? (
          <ErrorLine text={slice.error} />
        ) : loading && !slice.data ? (
          <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : rows.length === 0 ? (
          <p className="m-0 py-10 text-center text-[12.5px] text-muted-foreground">No billing recorded this year.</p>
        ) : (
          <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-3 p-0">
            {rows.map((r, i) => {
              const bill = num(r, "total_bill");
              return (
                <li key={`${getValue(r, "prin_code")}-${i}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10.5px] font-bold text-white" style={{ background: color, opacity: 1 - i * 0.14 }}>{i + 1}</span>
                      {(() => {
                        const code = String(getValue(r, "prin_code") ?? "").trim();
                        const name = names[code];
                        return (
                          <span className="min-w-0" title={name ? `${name} (${code})` : code}>
                            <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">{name || code}</span>
                            {name && <span className="block truncate text-[10.5px] leading-tight text-muted-foreground">{code}</span>}
                          </span>
                        );
                      })()}
                    </span>
                    <span className="shrink-0 text-right">
                      <b className="text-[12.5px] font-bold tabular-nums text-foreground">{fmtMoney(bill)}</b>
                      <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">{pct(bill, sum)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(bill / top) * 100}%`, background: color, opacity: 1 - i * 0.12 }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function WmsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [inKpi, setInKpi] = useState<Slice<JobKpi>>({ data: null, error: null });
  const [inTop, setInTop] = useState<Slice<any[]>>({ data: null, error: null });
  const [outKpi, setOutKpi] = useState<Slice<JobKpi>>({ data: null, error: null });
  const [outTop, setOutTop] = useState<Slice<any[]>>({ data: null, error: null });
  const [trfKpi, setTrfKpi] = useState<Slice<TrfKpi>>({ data: null, error: null });
  const [jobsMonthly, setJobsMonthly] = useState<Slice<{ inb: number[]; out: number[] }>>({ data: null, error: null });
  const [trfMonthly, setTrfMonthly] = useState<Slice<number[]>>({ data: null, error: null });
  const [prinNames, setPrinNames] = useState<Record<string, string>>({});

  // Optional font: loads Plus Jakarta Sans once, falls back to Inter/system if offline
  useEffect(() => {
    const id = "wms-dashboard-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const wrap = async <T,>(sql: string, map: (rows: any[]) => T, set: (s: Slice<T>) => void) => {
      try {
        set({ data: map(await runSql(sql)), error: null });
      } catch (e) {
        set({ data: null, error: e instanceof Error ? e.message : "Failed to load data." });
      }
    };
    await Promise.all([
      wrap(jobKpiSql("IMP", "TT_BATCH"), toJobKpi, setInKpi),
      wrap(topPrincipalSql("IMP"), (r) => r, setInTop),
      wrap(jobKpiSql("EXP", "TO_BATCH"), toJobKpi, setOutKpi),
      wrap(topPrincipalSql("EXP"), (r) => r, setOutTop),
      wrap(TRANSFER_KPI_SQL, (r): TrfKpi => ({
        total: num(r[0], "total_transfer"), pending: num(r[0], "transfer_pending"),
        confirmPending: num(r[0], "confirm_pending"), confirmed: num(r[0], "total_confirmed"),
      }), setTrfKpi),
      wrap(MONTHLY_JOBS_SQL, (r) => ({ inb: toMonthly(r, "confirmed_inbound"), out: toMonthly(r, "confirmed_outbound") }), setJobsMonthly),
      wrap(MONTHLY_TRANSFER_SQL, (r) => toMonthly(r, "confirmed_transfer"), setTrfMonthly),
      (async () => {
        try {
          const rows = await getPrincipalDropdown(user?.company_code ?? "", user?.loginid ?? "");
          const map: Record<string, string> = {};
          (Array.isArray(rows) ? rows : []).forEach((r: any) => {
            const code = String(getValue(r, "prin_code") ?? "").trim();
            if (code) map[code] = String(getValue(r, "prin_name") ?? "").trim();
          });
          setPrinNames(map);
        } catch {
          setPrinNames({});
        }
      })(),
    ]);
    setUpdatedAt(new Date());
    setLoading(false);
  }, [user?.company_code, user?.loginid]);

  useEffect(() => { if (user?.company_code) load(); }, [user?.company_code, load]);

  const year = new Date().getFullYear();
  const zeros = useMemo(() => Array(12).fill(0) as number[], []);

  const inD = inKpi.data, outD = outKpi.data, trfD = trfKpi.data;

  const hero = useMemo(() => {
    const billing = (inD?.revenue ?? 0) + (outD?.revenue ?? 0);
    const jobs = (inD?.total ?? 0) + (outD?.total ?? 0) + (trfD?.total ?? 0);
    const confirmed = (inD?.confirmed ?? 0) + (outD?.confirmed ?? 0) + (trfD?.confirmed ?? 0);
    const open =
      (inD?.pending ?? 0) + (inD?.confirmPending ?? 0) +
      (outD?.pending ?? 0) + (outD?.confirmPending ?? 0) +
      (trfD?.pending ?? 0) + (trfD?.confirmPending ?? 0);
    return { billing, jobs, confirmed, open, rate: Math.min(100, pct(confirmed, confirmed + open)) };
  }, [inD, outD, trfD]);

  const trendSeries = useMemo<TrendSeries[]>(() => [
    { key: "inbound", label: "Inbound", color: C.inbound, values: jobsMonthly.data?.inb ?? zeros },
    { key: "outbound", label: "Outbound", color: C.outbound, values: jobsMonthly.data?.out ?? zeros },
    { key: "transfer", label: "Transfer", color: C.transfer, values: trfMonthly.data ?? zeros },
  ], [jobsMonthly.data, trfMonthly.data, zeros]);

  const stageGroups = useMemo(() => [
    { label: "Pending", values: [inD?.pending ?? 0, outD?.pending ?? 0, trfD?.pending ?? 0] as [number, number, number] },
    { label: "Awaiting", values: [inD?.confirmPending ?? 0, outD?.confirmPending ?? 0, trfD?.confirmPending ?? 0] as [number, number, number] },
    { label: "Confirmed", values: [inD?.confirmed ?? 0, outD?.confirmed ?? 0, trfD?.confirmed ?? 0] as [number, number, number] },
  ], [inD, outD, trfD]);

  const inRev = inD?.revenue ?? 0;
  const outRev = outD?.revenue ?? 0;
  const revTotal = inRev + outRev;

  const errors = [inKpi, inTop, outKpi, outTop, trfKpi, jobsMonthly, trfMonthly].filter((s) => s.error);
  const busyFirst = loading && !updatedAt;

  return (
    <div className="grid gap-3" style={{ fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" }}>
      {/* Hero: one slim row on wide screens */}
      <section
        className="relative overflow-hidden rounded-2xl px-4 py-3 text-white shadow-md"
        style={{ background: "linear-gradient(118deg, #00246B 0%, #00378C 48%, #1467D6 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid items-center gap-3 2xl:grid-cols-[300px_1fr]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight">Warehouse overview</h1>
              <p className="m-0 mt-0.5 text-[12px] leading-snug text-white/70">
                Year to date, 1 Jan {year} to today
                {updatedAt ? `. Updated ${updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </p>
            </div>
            <button
              type="button" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh dashboard"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat label="Total billing" value={fmtCompact(hero.billing)} sub={`In ${fmtCompact(inRev)}, out ${fmtCompact(outRev)}`} loading={busyFirst} />
            <HeroStat label="Total jobs" value={fmtInt(hero.jobs)} sub={`${fmtInt(inD?.total ?? 0)} in, ${fmtInt(outD?.total ?? 0)} out, ${fmtInt(trfD?.total ?? 0)} transfer`} loading={busyFirst} />
            <HeroStat label="Confirmed" value={fmtInt(hero.confirmed)} sub={`${hero.rate}% of handled work`} loading={busyFirst} />
            <HeroStat label="Needs action" value={fmtInt(hero.open)} sub="Pending plus awaiting confirm" loading={busyFirst} />
          </div>
        </div>
      </section>

      {errors.length > 0 && (
        <ErrorLine text={`${errors.length} of 7 queries failed. First error: ${errors[0].error}`} />
      )}

      {/* Row 1: three flows + billing split */}
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <FlowCard
          title="Inbound" icon={ArrowDownToLine} color={C.inbound} data={inD} loading={loading}
          footer={{ label: "Billing", value: fmtMoney(inRev), icon: Wallet2 }}
          stageLabels={["Putaway pending", "Confirm pending", "GRN confirmed"]}
        />
        <FlowCard
          title="Outbound" icon={ArrowUpFromLine} color={C.outbound} data={outD} loading={loading}
          footer={{ label: "Billing", value: fmtMoney(outRev), icon: Wallet2 }}
          stageLabels={["Pick pending", "Confirm pending", "Delivered"]}
        />
        <FlowCard
          title="Transfer" icon={ArrowLeftRight} color={C.transfer} data={trfD} loading={loading}
          footer={{ label: "Open transfers", value: fmtInt((trfD?.pending ?? 0) + (trfD?.confirmPending ?? 0)), icon: Layers }}
          stageLabels={["Transfer pending", "Confirm pending", "Confirmed"]}
        />

        <section className={`${card} flex min-w-0 flex-col gap-2 p-3.5`}>
          <CardHead title="Billing split" subtitle="Inbound vs outbound revenue" />
          <div className="flex flex-1 items-center gap-3">
            {busyFirst ? <Skeleton className="h-[96px] w-[96px] rounded-full" /> : (
              <Donut size={96} thickness={12} segments={[{ value: inRev, color: C.inbound }, { value: outRev, color: C.outbound }]}>
                <div>
                  <p className="m-0 text-[17px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{fmtCompact(revTotal)}</p>
                  <p className="m-0 mt-0.5 text-[10px] text-muted-foreground">total</p>
                </div>
              </Donut>
            )}
            <div className="grid min-w-0 flex-1 gap-2">
              {[
                ["Inbound", inRev, C.inbound],
                ["Outbound", outRev, C.outbound],
              ].map(([label, value, color]) => (
                <div key={label as string} className="rounded-xl bg-muted/60 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <LegendDot color={color as string} label={label as string} />
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{pct(value as number, revTotal)}%</span>
                  </div>
                  <b className="text-[13px] font-bold tabular-nums text-foreground">{fmtMoney(value as number)}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: trend + stage comparison + principals */}
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-12">
        <section className={`${card} min-w-0 p-3.5 lg:col-span-2 2xl:col-span-6`}>
          <CardHead title="Confirmed jobs by month" subtitle="Click a legend chip to hide a line" />
          <TrendChart series={trendSeries} loading={busyFirst} />
        </section>

        <section className={`${card} min-w-0 p-3.5 2xl:col-span-3`}>
          <CardHead title="Workload by stage" subtitle="Current status by flow" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[["Inbound", C.inbound], ["Outbound", C.outbound], ["Transfer", C.transfer]].map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 text-[11.5px] font-medium text-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
          <StageBars groups={stageGroups} loading={busyFirst} />
        </section>

        <div className="min-w-0 2xl:col-span-3 [&>section]:h-full">
          <PrincipalsCard inbound={inTop} outbound={outTop} names={prinNames} loading={loading} />
        </div>
      </div>
    </div>
  );
}