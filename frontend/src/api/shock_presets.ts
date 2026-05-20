import client from "./client";

export type ShockPreset = {
  id: number;
  name: string;
  rider_weight: number;
  passenger_weight: number;
  mode: string;
  preload: number;
  comp: number;
  reb: number;
  note: string | null;
  created_at: string;
  user_id: number | null;
  motorcycle_id: number | null;
  shock_brand: string | null;
  shock_model: string | null;
};

export type ShockPresetCreate = Omit<ShockPreset, "id" | "created_at">;
export type ShockPresetUpdate = Partial<ShockPresetCreate>;

export const listPresets = (bikeId?: number) => {
  const url = bikeId
    ? `/api/shock-presets?motorcycle_id=${bikeId}`
    : "/api/shock-presets";
  return client.get<ShockPreset[]>(url).then((r) => r.data);
};

export const createPreset = (data: ShockPresetCreate) =>
  client.post<ShockPreset>("/api/shock-presets", data).then((r) => r.data);

export const updatePreset = (id: number, data: ShockPresetUpdate) =>
  client.patch<ShockPreset>(`/api/shock-presets/${id}`, data).then((r) => r.data);

export const deletePreset = (id: number) =>
  client.delete(`/api/shock-presets/${id}`);
