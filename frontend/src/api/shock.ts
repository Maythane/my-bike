import client from "./client";

export type ShockSetting = {
  id: number;
  rider_weight: number;
  passenger_weight: number;
  mode: string;
};

export const getShockSetting = () =>
  client.get<ShockSetting>("/api/shock-setting").then((r) => r.data);

export const updateShockSetting = (data: Partial<Omit<ShockSetting, "id">>) =>
  client.put<ShockSetting>("/api/shock-setting", data).then((r) => r.data);
