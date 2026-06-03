import client from "./client";
import type { ServiceReminder } from "../types";

export const getReminders = (bikeId: number) =>
  client.get<ServiceReminder[]>(`/api/motorcycles/${bikeId}/service-reminders`).then((r) => r.data);

export const updateReminders = (
  bikeId: number,
  updates: { item_key: string; item_name?: string; interval_km: number; enabled: boolean }[],
) =>
  client.put<ServiceReminder[]>(`/api/motorcycles/${bikeId}/service-reminders`, updates).then((r) => r.data);

export const createReminder = (
  bikeId: number,
  body: { item_name: string; interval_km: number },
) =>
  client.post<ServiceReminder>(`/api/motorcycles/${bikeId}/service-reminders`, body).then((r) => r.data);

export const deleteReminder = (bikeId: number, itemKey: string) =>
  client.delete(`/api/motorcycles/${bikeId}/service-reminders/${itemKey}`);

export const markReminderDone = (
  bikeId: number,
  itemKey: string,
  body?: { mileage?: number; interval_km?: number },
) =>
  client.post<ServiceReminder>(
    `/api/motorcycles/${bikeId}/service-reminders/${itemKey}/done`,
    body ?? {},
  ).then((r) => r.data);
