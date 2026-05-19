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
};

export type ShockPresetCreate = Omit<ShockPreset, "id" | "created_at">;

export const listPresets = () =>
  client.get<ShockPreset[]>("/api/shock-presets").then((r) => r.data);

export const createPreset = (data: ShockPresetCreate) =>
  client.post<ShockPreset>("/api/shock-presets", data).then((r) => r.data);

export const updatePreset = (id: number, data: Partial<ShockPresetCreate>) =>
  client.patch<ShockPreset>(`/api/shock-presets/${id}`, data).then((r) => r.data);

export const deletePreset = (id: number) =>
  client.delete(`/api/shock-presets/${id}`);
