import type { CSSProperties } from "react";
import type { MonthBucket } from "../../types";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                     "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function ExpenseTrendChart({ buckets }: { buckets: MonthBucket[] }) {
  const maxTotal = Math.max(...buckets.map((b) => b.fuel + b.maintenance + b.other), 1);

  return (
    <div role="group" aria-label={`กราฟค่าใช้จ่าย ${buckets.length} เดือน แยกน้ำมัน ซ่อมบำรุง และอื่นๆ`}>
      <table className="sr-only">
        <caption>รายละเอียดค่าใช้จ่ายรายเดือน</caption>
        <thead>
          <tr>
            <th>เดือน</th>
            <th>น้ำมัน</th>
            <th>ซ่อมบำรุง</th>
            <th>อื่นๆ</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.month}>
              <td>{b.month}</td>
              <td>{b.fuel}</td>
              <td>{b.maintenance}</td>
              <td>{b.other}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 60 }}>
        {buckets.map((b, i) => {
          const total = b.fuel + b.maintenance + b.other;
          const fuelH  = (b.fuel / maxTotal) * 100;
          const maintH = (b.maintenance / maxTotal) * 100;
          const otherH = (b.other / maxTotal) * 100;
          const isCurrent = buckets.indexOf(b) === buckets.length - 1;
          return (
            <div
              key={b.month}
              className="expense-trend-column"
              style={{
                "--i": i,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
              } as CSSProperties}
              title={`${b.month}: ฿${total.toLocaleString()}`}>
              <div style={{ width: "100%", display: "flex", flexDirection: "column",
                             justifyContent: "flex-end", height: 52, gap: 1 }}>
                {otherH > 0 && (
                  <div className="expense-trend-segment" style={{ width: "100%", height: `${otherH}%`, borderRadius: "2px 2px 0 0",
                                                                   background: isCurrent ? "var(--expense-other)" : "var(--expense-other-bg)" }} />
                )}
                {maintH > 0 && (
                  <div className="expense-trend-segment" style={{ width: "100%", height: `${maintH}%`,
                                                                   background: isCurrent ? "var(--expense-maintenance)" : "var(--expense-maintenance-bg)" }} />
                )}
                {fuelH > 0 && (
                  <div className="expense-trend-segment" style={{ width: "100%", height: `${fuelH}%`, borderRadius: "0 0 2px 2px",
                                                                   background: isCurrent ? "var(--expense-fuel)" : "var(--expense-fuel-bg)" }} />
                )}
                {total === 0 && (
                  <div style={{ width: "100%", height: 3, borderRadius: 2,
                                 background: "var(--hairline)" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
        {buckets.map((b, i) => {
          const mo = b.month.split("-")[1];
          const label = THAI_MONTHS[parseInt(mo) - 1];
          const isCurrent = i === buckets.length - 1;
          return (
            <div key={b.month} style={{ flex: 1, textAlign: "center", fontSize: 11,
                                         color: isCurrent ? "var(--purple)" : "var(--steel)" }}>
              {label}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--expense-fuel)" }}>■ น้ำมัน</span>
        <span style={{ fontSize: 11, color: "var(--expense-maintenance)" }}>■ ซ่อมบำรุง</span>
        <span style={{ fontSize: 11, color: "var(--expense-other)" }}>■ อื่นๆ</span>
      </div>
    </div>
  );
}
