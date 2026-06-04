import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { createMotorcycleSimple, updateMotorcycle } from "../../api/motorcycles";
import type { Motorcycle } from "../../types";

interface Props {
  bike?: Motorcycle;
  onClose: () => void;
}

export default function BikeForm({ bike, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    make: bike?.make ?? "",
    model: bike?.model ?? "",
    year: bike?.year ?? new Date().getFullYear(),
    nickname: bike?.nickname ?? "",
    color: bike?.color ?? "",
    license_plate: bike?.license_plate ?? "",
    registration_year: bike?.registration_year ?? "",
    engine_cc: bike?.engine_cc ?? "",
    tank_capacity: bike?.tank_capacity ?? "",
    current_mileage: bike?.current_mileage ?? 0,
    mileage_unit: bike?.mileage_unit ?? "km",
  });

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        registration_year: form.registration_year !== "" ? Number(form.registration_year) : null,
        engine_cc: form.engine_cc !== "" ? Number(form.engine_cc) : null,
        tank_capacity: form.tank_capacity !== "" ? Number(form.tank_capacity) : null,
        nickname: form.nickname || null,
        color: form.color || null,
        license_plate: form.license_plate || null,
      };
      return bike
        ? updateMotorcycle(bike.id, payload)
        : createMotorcycleSimple(payload);
    },
    onMutate: () => onClose(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["motorcycles"] });
      if (bike) {
        qc.invalidateQueries({ queryKey: ["motorcycle", bike.id] });
        qc.invalidateQueries({ queryKey: ["service-logs", bike.id] });
      }
    },
  });

  const isValid = form.make && form.model && form.year;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{bike ? "แก้ไขรถ" : "เพิ่มรถ"}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
        <div className="form-row">
          <div className="form-group">
            <label>ยี่ห้อ</label>
            <input autoFocus value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="Honda" />
          </div>
          <div className="form-group">
            <label>รุ่น</label>
            <input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="CB650R" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>ปีผลิต (Model Year)</label>
            <input type="number" value={form.year} onChange={(e) => set("year", +e.target.value)} placeholder="2022" />
          </div>
          <div className="form-group">
            <label>ปีจดทะเบียน</label>
            <input type="number" value={form.registration_year} onChange={(e) => set("registration_year", e.target.value)} placeholder="2022" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>ชื่อเรียก (ไม่บังคับ)</label>
            <input value={form.nickname} onChange={(e) => set("nickname", e.target.value)} placeholder="Duke งาน" />
          </div>
          <div className="form-group">
            <label>สีรถ (ไม่บังคับ)</label>
            <input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="สีแดง / Candy Red" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>ความจุเครื่อง (CC)</label>
            <input type="number" value={form.engine_cc} onChange={(e) => set("engine_cc", e.target.value)} placeholder="649" />
          </div>
          <div className="form-group">
            <label>ความจุถังน้ำมัน (ลิตร)</label>
            <input type="number" step="0.1" value={form.tank_capacity} onChange={(e) => set("tank_capacity", e.target.value)} placeholder="15.4" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>เลขไมล์ปัจจุบัน</label>
            <input type="number" value={form.current_mileage} onChange={(e) => set("current_mileage", +e.target.value)} />
          </div>
          <div className="form-group">
            <label>หน่วย</label>
            <select value={form.mileage_unit} onChange={(e) => set("mileage_unit", e.target.value)}>
              <option value="km">km</option>
              <option value="miles">miles</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>ทะเบียนรถ (optional)</label>
          <input value={form.license_plate} onChange={(e) => set("license_plate", e.target.value)} placeholder="กข 1234" />
        </div>
        </div>{/* modal-body */}

        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button variant="default" disabled={!isValid || mut.isPending} onClick={() => mut.mutate()}>
            {bike ? "บันทึก" : "เพิ่มรถ"}
          </Button>
        </div>
      </div>
    </div>
  );
}
