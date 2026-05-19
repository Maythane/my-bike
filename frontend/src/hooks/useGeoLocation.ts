import { useState } from "react";

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=th`,
    { headers: { "User-Agent": "MyBikeApp/1.0" } }
  );
  const data = await res.json();
  const addr = data.address || {};
  const name =
    addr.amenity || addr.shop || addr.fuel || addr.fast_food ||
    addr.cafe || addr.restaurant || addr.convenience || "";
  const road = addr.road || addr.pedestrian || "";
  const area =
    addr.suburb || addr.quarter || addr.neighbourhood ||
    addr.town || addr.city_district || addr.city || "";
  return [name, road, area].filter(Boolean).join(", ") || data.display_name || "";
}

export function useGeoLocation(onResult: (location: string) => void) {
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("เบราว์เซอร์ไม่รองรับ GPS");
      return;
    }
    setLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          onResult(loc);
        } catch {
          setGeoError("ดึงที่อยู่ไม่ได้");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) setGeoError("ไม่ได้รับอนุญาต GPS");
        else setGeoError("ดึง GPS ไม่ได้");
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  return { getLocation, loading, geoError };
}
