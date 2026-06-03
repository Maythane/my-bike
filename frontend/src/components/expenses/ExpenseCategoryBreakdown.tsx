import type { CSSProperties } from "react";
import type { CategoryTotal } from "../../types";

const CATEGORY_COLORS: Record<string, string> = {
  fuel:         "var(--expense-fuel)",
  maintenance:  "var(--expense-maintenance)",
  insurance:    "var(--expense-insurance)",
  registration: "var(--expense-registration)",
  parts:        "var(--expense-parts)",
  parking:      "var(--steel)",
  other:        "var(--steel)",
};

export default function ExpenseCategoryBreakdown({ items }: { items: CategoryTotal[] }) {
  if (items.length === 0) return (
    <p style={{ color: "var(--slate)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
      ยังไม่มีข้อมูลค่าใช้จ่าย
    </p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => {
        const color = CATEGORY_COLORS[item.category] ?? "var(--steel)";
        return (
          <div
            key={item.category}
            className="expense-category-row"
            style={{ "--i": i } as CSSProperties}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: "var(--ink)" }}>{item.label}</span>
            </div>
            <div style={{ flex: 1, height: 4, background: "var(--hairline)", borderRadius: 99, overflow: "hidden" }}>
              <div className="expense-category-bar" style={{ width: "100%", height: "100%", background: color, borderRadius: 99,
                                                              "--target": item.percent / 100 } as CSSProperties} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 64, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ฿{item.amount.toLocaleString()}
            </span>
            <span className="sr-only">{item.percent}% ของค่าใช้จ่ายทั้งหมด</span>
          </div>
        );
      })}
    </div>
  );
}
