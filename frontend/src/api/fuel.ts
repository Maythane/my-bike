import client from "./client";
import type { FuelLog, FuelEconomy } from "../types";

export const getFuelLogs = (bikeId: number) =>
  client.get<FuelLog[]>(`/api/motorcycles/${bikeId}/fuel-logs`).then((r) => r.data);

export const getFuelEconomy = (bikeId: number) =>
  client.get<FuelEconomy>(`/api/motorcycles/${bikeId}/fuel-economy`).then((r) => r.data);

export const createFuelLog = (bikeId: number, data: {
  date: string;
  mileage_at_fillup: number;
  fuel_amount: number;
  fuel_type: string;
  is_full_tank?: boolean;
  cost?: number | null;
  location?: string | null;
  notes?: string | null;
}) => client.post<FuelLog>(`/api/motorcycles/${bikeId}/fuel-logs`, data).then((r) => r.data);

export const updateFuelLog = (logId: number, data: {
  date?: string;
  mileage_at_fillup?: number;
  fuel_amount?: number;
  fuel_type?: string;
  is_full_tank?: boolean;
  cost?: number | null;
  location?: string | null;
  notes?: string | null;
}) => client.put<FuelLog>(`/api/fuel-logs/${logId}`, data).then((r) => r.data);

export const uploadFuelLogImage = (logId: number, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post<FuelLog>(`/api/fuel-logs/${logId}/images`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);
};

export const deleteFuelLogImageById = (imgId: number) =>
  client.delete(`/api/fuel-log-images/${imgId}`);

export const deleteFuelLog = (id: number) =>
  client.delete(`/api/fuel-logs/${id}`);
