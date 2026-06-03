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

export const lookupShockChart = (
  brand: string,
  model: string | null,
  motoMake: string | null,
  motoModel: string | null,
) =>
  client.get<{ found: boolean; bands: ShockBand[] | null }>("/api/shock-charts/lookup", {
    params: {
      brand,
      ...(model ? { model } : {}),
      ...(motoMake ? { moto_make: motoMake } : {}),
      ...(motoModel ? { moto_model: motoModel } : {}),
    },
  }).then((r) => r.data);
