import client from "./client";
import type { ShockSetting, ShockBand } from "../types";

export type { ShockSetting };

export const getShockSetting = (bikeId: number) =>
  client.get<ShockSetting>(`/api/motorcycles/${bikeId}/shock-setting`).then((r) => r.data);

export const updateShockSetting = (
  bikeId: number,
  data: Partial<Omit<ShockSetting, "id" | "motorcycle_id" | "user_id">>,
) => client.put<ShockSetting>(`/api/motorcycles/${bikeId}/shock-setting`, data).then((r) => r.data);

export const getShockChart = (bikeId: number) =>
  client.get<{ bands: ShockBand[] | null }>(`/api/motorcycles/${bikeId}/shock-chart`).then((r) => r.data);
