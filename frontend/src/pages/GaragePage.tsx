import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllMotorcycles } from "../api/motorcycles";
import BikeCard from "../components/bikes/BikeCard";
import BikeForm from "../components/bikes/BikeForm";
import SkeletonCard from "../components/ui/SkeletonCard";

export default function GaragePage() {
  const [showForm, setShowForm] = useState(false);

  const { data: bikes, isLoading } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: getAllMotorcycles,
  });

  return (
    <div className="page">
      <div className="garage-header">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px" }}>Garage</h1>
          {bikes && bikes.length > 0 && (
            <p style={{ fontSize: 13, color: "var(--slate)", marginTop: 3 }}>{bikes.length} คัน</p>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          + เพิ่มรถ
        </button>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonCard /><SkeletonCard />
        </div>
      )}

      {!isLoading && bikes?.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🏍️</div>
          <h3>ยังไม่มีรถ</h3>
          <p>เพิ่มรถเพื่อเริ่มบันทึกประวัติการบำรุงรักษา</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ เพิ่มรถคันแรก</button>
        </div>
      )}

      {!isLoading && bikes && bikes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bikes.map((bike) => <BikeCard key={bike.id} bike={bike} />)}
        </div>
      )}

      {showForm && <BikeForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
