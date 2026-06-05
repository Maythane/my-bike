import { useState, useEffect } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getExpenseSummary } from "../api/expenses";
import { getAllMotorcycles } from "../api/motorcycles";
import type { ExpenseSummary, MonthBucket, CategoryTotal } from "../types";
import ExpenseCategoryBreakdown from "../components/expenses/ExpenseCategoryBreakdown";
import ExpenseTrendChart from "../components/expenses/ExpenseTrendChart";
import ExpenseModal from "../components/expenses/ExpenseModal";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                     "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function mergeSummaries(summaries: ExpenseSummary[]): ExpenseSummary {
  const total = summaries.reduce((s, x) => s + x.total, 0);
  const catMap: Record<string, CategoryTotal> = {};
  for (const s of summaries) {
    for (const c of s.by_category) {
      if (!catMap[c.category]) {
        catMap[c.category] = { ...c, amount: 0, percent: 0 };
      }
      catMap[c.category].amount += c.amount;
    }
  }
  const by_category = Object.values(catMap)
    .map((c) => ({ ...c, amount: Math.round(c.amount * 100) / 100,
                   percent: total > 0 ? Math.round((c.amount / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Merge monthly_trend: sum same-month buckets
  const trendMap: Record<string, MonthBucket> = {};
  for (const s of summaries) {
    for (const b of s.monthly_trend) {
      if (!trendMap[b.month]) trendMap[b.month] = { month: b.month, fuel: 0, maintenance: 0, other: 0 };
      trendMap[b.month].fuel        += b.fuel;
      trendMap[b.month].maintenance += b.maintenance;
      trendMap[b.month].other       += b.other;
    }
  }
  const monthly_trend = Object.values(trendMap).sort((a, b) => a.month.localeCompare(b.month));

  const cost_per_km = null; // not meaningful when aggregated across bikes
  return { total: Math.round(total * 100) / 100, cost_per_km, by_category, monthly_trend };
}

export default function ExpenseDashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [bikeFilter, setBikeFilter] = useState<number | "all">("all");
  const [showModal, setShowModal] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && filterOpen) setFilterOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterOpen]);

  const { data: bikes = [], isLoading: bikesLoading } = useQuery({ queryKey: ["motorcycles"], queryFn: getAllMotorcycles });

  const targetBikes = bikeFilter === "all" ? bikes : bikes.filter((b) => b.id === bikeFilter);

  const summaryQueries = useQueries({
    queries: targetBikes.map((b) => ({
      queryKey: ["expense-summary", b.id, year, month],
      queryFn: () => getExpenseSummary(b.id, year, month ?? undefined),
      enabled: targetBikes.length > 0,
    })),
  });

  const allLoaded = !bikesLoading && summaryQueries.every((q) => !q.isLoading);
  const hasError = !bikesLoading && (summaryQueries.some((q) => q.isError) || (targetBikes.length === 0 && bikes.length > 0));
  const summaries = summaryQueries.map((q) => q.data).filter(Boolean) as ExpenseSummary[];
  const summary = summaries.length > 0 ? mergeSummaries(summaries) : null;

  const singleBikeSummary = bikeFilter !== "all" && summaries.length === 1 ? summaries[0] : null;
  const periodLabel = month ? `${THAI_MONTHS[month - 1]} ${year}` : `ปี ${year}`;
  const bikeLabel = bikeFilter === "all"
    ? "ทุกคัน"
    : (bikes.find((b) => b.id === bikeFilter)?.nickname ?? "รถ 1 คัน");
  const topCategory = summary?.by_category[0] ?? null;

  return (
    <div className="relative min-h-dvh pb-20 max-w-[680px] w-full mx-auto overflow-x-hidden touch-pan-y px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-4 max-[420px]:flex-col max-[420px]:items-stretch">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0, letterSpacing: "-0.03em" }}>ค่าใช้จ่าย</h1>
          <p style={{ margin: "3px 0 0", color: "var(--slate)", fontSize: 13 }}>
            {periodLabel} · {bikeLabel}
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          className="min-h-[44px] max-[420px]:w-full max-[420px]:justify-center"
          onClick={() => setShowModal(true)}
        >+ เพิ่มค่าใช้จ่าย</Button>
      </div>

      {/* Compact filter card */}
      <div
        className={`expense-filter-card${filterOpen ? " open" : ""}`}
        role="button"
        tabIndex={0}
        aria-expanded={filterOpen}
        aria-label="ตัวกรองช่วงเวลาและรถ"
        onClick={() => setFilterOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFilterOpen((v) => !v); } }}
      >
        <div className="expense-filter-header">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="expense-filter-period">
              {periodLabel}
            </span>
            {bikes.length > 0 && (
              <>
                <span style={{ color: "var(--steel)", fontSize: 12 }}>·</span>
                <span style={{ fontSize: 13, color: "var(--slate)" }}>
                  {bikeLabel}
                </span>
              </>
            )}
          </div>
          <div className="expense-filter-chevron" />
        </div>

        {filterOpen && (
          <div className="expense-filter-panel" onClick={(e) => e.stopPropagation()}>
            {/* Bike filter — only shown when 2+ bikes */}
            {bikes.length > 1 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {[{ id: "all" as const, label: "ทุกคัน" },
                  ...bikes.map((b) => ({ id: b.id, label: b.nickname ?? `${b.make} ${b.model}` })),
                ].map(({ id, label }) => (
                  <button key={String(id)} onClick={() => setBikeFilter(id)}
                    className={`expense-chip${bikeFilter === id ? " active" : ""}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Year nav */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <button onClick={() => setYear((y) => y - 1)} className="expense-year-nav">‹</button>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", minWidth: 44, textAlign: "center" }}>{year}</span>
              {year < now.getFullYear() && (
                <button onClick={() => setYear((y) => y + 1)} className="expense-year-nav">›</button>
              )}
              {(year !== now.getFullYear() || month !== now.getMonth() + 1) && (
                <button
                  onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}
                  className="expense-reset-filter"
                  style={{ marginLeft: "auto" }}>
                  เดือนนี้
                </button>
              )}
            </div>

            {/* Month grid — 4 columns, 44px tap targets */}
            <div className="expense-month-grid">
              {THAI_MONTHS.map((label, i) => {
                const m = i + 1;
                const active = month === m;
                const isFuture = year === now.getFullYear() && m > now.getMonth() + 1;
                return (
                  <button key={m} disabled={isFuture}
                    onClick={() => setMonth(month === m ? null : m)}
                    className={`expense-month-chip${active ? " active" : ""}${isFuture ? " future" : ""}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!allLoaded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label="กำลังโหลดข้อมูลค่าใช้จ่าย">
          <Card style={{ height: 78 }} />
          <Card style={{ height: 136 }} />
          <Card style={{ height: 148 }} />
        </div>
      )}

      {allLoaded && hasError && (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon">!</div>
          <h3>โหลดค่าใช้จ่ายไม่สำเร็จ</h3>
          <p>ข้อมูลยังอยู่ครบ ลองเปลี่ยนตัวกรองหรือโหลดหน้านี้ใหม่อีกครั้ง</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            โหลดใหม่
          </Button>
        </div>
      )}

      {allLoaded && !hasError && summary && (
        <>
          {/* KPI */}
          <div className="flex gap-2.5 mb-3 max-[420px]:flex-col">
            <Card className="expense-total-card">
              <div className="expense-kpi-label">รวมทั้งหมด</div>
              <div className="expense-total-value">
                ฿{summary.total.toLocaleString()}
              </div>
              <div className="expense-kpi-context">
                {topCategory ? `${topCategory.icon} ${topCategory.label} มากสุด ${topCategory.percent}%` : "ยังไม่มีหมวดหมู่หลัก"}
              </div>
            </Card>
            {singleBikeSummary?.cost_per_km != null && (
              <Card className="expense-cost-card">
                <div className="expense-kpi-label">ต้นทุนต่อกม.</div>
                <div className="expense-cost-value">
                  ฿{singleBikeSummary.cost_per_km}
                </div>
                <div className="expense-kpi-context">คำนวณจากระยะทางช่วงนี้</div>
              </Card>
            )}
          </div>

          {/* Trend chart */}
          {summary.monthly_trend.length > 0 && (
            <Card style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--slate)", margin: "0 0 10px" }}>
                แนวโน้ม {summary.monthly_trend.length} เดือน
              </p>
              <ExpenseTrendChart buckets={summary.monthly_trend} />
            </Card>
          )}

          {/* Category breakdown */}
          {summary.by_category.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--slate)", margin: "0 0 10px" }}>
                หมวดหมู่
              </p>
              <ExpenseCategoryBreakdown items={summary.by_category} />
            </Card>
          )}
        </>
      )}

      {allLoaded && !hasError && (!summary || summary.total === 0) && (
        <div className="empty-state">
          <div className="empty-state-icon">฿</div>
          <h3>ยังไม่มีค่าใช้จ่ายในช่วงนี้</h3>
          <p>เริ่มจากบันทึกประกัน ต่อทะเบียน อะไหล่ หรือค่าใช้จ่ายอื่นที่ไม่ใช่น้ำมัน</p>
          <Button variant="default" onClick={() => setShowModal(true)}>
            เพิ่มค่าใช้จ่าย
          </Button>
        </div>
      )}

      {showModal && <ExpenseModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
