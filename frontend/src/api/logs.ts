import client from "./client";
import type { ServiceLog } from "../types";

export const getServiceLogs = (bikeId: number) =>
  client.get<ServiceLog[]>(`/api/motorcycles/${bikeId}/service-logs`).then((r) => r.data);

export const createServiceLog = (bikeId: number, data: {
  name: string;
  date_performed: string;
  mileage_at_service: number;
  cost?: number | null;
  location?: string | null;
  notes?: string | null;
}) => client.post<ServiceLog>(`/api/motorcycles/${bikeId}/service-logs`, data).then((r) => r.data);

export const updateServiceLog = (logId: number, data: {
  name?: string;
  date_performed?: string;
  mileage_at_service?: number;
  cost?: number | null;
  location?: string | null;
  notes?: string | null;
}) => client.put<ServiceLog>(`/api/service-logs/${logId}`, data).then((r) => r.data);

export const uploadServiceLogImage = (logId: number, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post<ServiceLog>(`/api/service-logs/${logId}/images`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);
};

export const deleteServiceLogImageById = (imgId: number) =>
  client.delete(`/api/service-log-images/${imgId}`);

export const deleteServiceLog = (id: number) =>
  client.delete(`/api/service-logs/${id}`);
