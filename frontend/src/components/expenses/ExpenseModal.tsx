import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExpense, updateExpense } from "../../api/expenses";
import { getAllMotorcycles } from "../../api/motorcycles";
import { useQuery } from "@tanstack/react-query";
import type { ExpenseRead } from "../../types";

const PRESET_CATS = [
  { key: "insurance",    label: "ประกันภัย",  icon: "🛡️" },
  { key: "registration", label: "ต่อทะเบียน", icon: "📋" },
  { key: "parts",        label: "อะไหล่",     icon: "⚙️" },
  { key: "parking",      label: "ค่าจอด",     icon: "🅿️" },
  { key: "other",        label: "อื่นๆ",      icon: "📌" },
];

interface Props {
  bikeId?: number;         // pre-filled if opened from BikePage
  expense?: ExpenseRead;   // set for edit mode
  onClose: () => void;
}

export default function ExpenseModal({ bikeId, expense, onClose }: Props) {
  const qc = useQueryClient();
  const { data: bikes = [], isLoading: bikesLoading, isError: bikesError } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: getAllMotorcycles,
  });

  const today = new Date().toISOString().slice(0, 10);
  const [selectedBike, setSelectedBike] = useState<number>(bikeId ?? 0);
  const [category, setCategory] = useState(expense?.category ?? "insurance");
  const [customCat, setCustomCat] = useState(() => {
    if (!expense?.category) return "";
    const PRESET_KEYS = ["insurance","registration","parts","parking","other"];
    return PRESET_KEYS.includes(expense.category) ? "" : expense.category;
  });
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [date, setDate] = useState(expense?.date ?? today);
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const parsedAmount = Number(amount);
  const amountTouched = amount.trim().length > 0;

  useEffect(() => {
    if (!selectedBike && bikes.length > 0) setSelectedBike(bikes[0].id);
  }, [bikes]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCustom = !PRESET_CATS.find((p) => p.key === category);
  const finalCategory = isCustom ? (customCat || category) : category;

  const saveMut = useMutation({
    mutationFn: () => {
      const data = {
        category: finalCategory,
        amount: parseFloat(amount),
        date,
        notes: notes || null,
      };
      return expense
        ? updateExpense(selectedBike, expense.id, data)
        : createExpense(selectedBike, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-summary"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    },
  });

  const canSave = selectedBike > 0
    && (isCustom ? customCat.trim().length > 0 : !!category)
    && amountTouched
    && Number.isFinite(parsedAmount)
    && parsedAmount > 0
    && !!date
    && !bikesLoading
    && !bikesError;

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal modal-form expense-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) saveMut.mutate();
        }}
      >
        <div className="modal-header">
          <h2 id="expense-modal-title" className="modal-title">
            {expense ? "แก้ไขค่าใช้จ่าย" : "เพิ่มค่าใช้จ่าย"}
          </h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="ปิดหน้าต่าง">×</button>
        </div>

        <div className="modal-body">
          {bikesError && (
            <div className="expense-inline-error" role="alert">
              โหลดรายชื่อรถไม่สำเร็จ ลองปิดแล้วเปิดใหม่อีกครั้ง
            </div>
          )}

          {!bikeId && (
            <div className="form-group">
              <label className="expense-field-label" htmlFor="expense-bike">รถมอเตอร์ไซค์</label>
              <select
                id="expense-bike"
                className="expense-field"
                value={selectedBike}
                disabled={bikesLoading || bikes.length === 0}
                onChange={(e) => setSelectedBike(Number(e.target.value))}
              >
                {bikesLoading && <option value={0}>กำลังโหลดรถ...</option>}
                {!bikesLoading && bikes.length === 0 && <option value={0}>ยังไม่มีรถ</option>}
                {bikes.map((b) => (
                  <option key={b.id} value={b.id}>{b.nickname ?? `${b.make} ${b.model}`}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="expense-field-label">หมวดหมู่</label>
            <div className="expense-category-chip-row" role="group" aria-label="เลือกหมวดหมู่ค่าใช้จ่าย">
              {PRESET_CATS.map((p) => {
                const active = category === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => { setCategory(p.key); setCustomCat(""); }}
                    className={`expense-chip${active ? " active" : ""}`}
                    aria-pressed={active}
                  >
                    {p.icon} {p.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCategory("__custom__")}
                className={`expense-chip${isCustom ? " active" : ""}`}
                aria-pressed={isCustom}
              >
                + กำหนดเอง
              </button>
            </div>
            {isCustom && (
              <input
                aria-label="ชื่อหมวดหมู่กำหนดเอง"
                placeholder="ชื่อหมวดหมู่"
                value={customCat}
                onChange={(e) => setCustomCat(e.target.value)}
                className="expense-field"
                style={{ marginTop: 8 }}
              />
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="expense-field-label" htmlFor="expense-amount">จำนวนเงิน (฿)</label>
              <input
                id="expense-amount"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="expense-field"
                aria-invalid={amountTouched && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)}
                aria-describedby="expense-amount-help"
              />
              <div id="expense-amount-help" className="expense-field-help">
                {amountTouched && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
                  ? "จำนวนเงินต้องมากกว่า 0"
                  : "ใส่เฉพาะจำนวนเงินที่จ่ายจริง"}
              </div>
            </div>
            <div className="form-group">
              <label className="expense-field-label" htmlFor="expense-date">วันที่</label>
              <input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="expense-field"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="expense-field-label" htmlFor="expense-notes">หมายเหตุ (ไม่บังคับ)</label>
            <textarea
              id="expense-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="expense-field"
            />
          </div>

          {saveMut.isError && (
            <div className="expense-inline-error" role="alert">
              บันทึกค่าใช้จ่ายไม่สำเร็จ กรุณาลองอีกครั้ง
            </div>
          )}
        </div>

        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button variant="default" disabled={!canSave || saveMut.isPending}>
            {saveMut.isPending ? "กำลังบันทึก…" : expense ? "บันทึกการแก้ไข" : "เพิ่มค่าใช้จ่าย"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
