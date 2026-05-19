import client from "./client";
import type { TaskWithStatus } from "../types";

export const getTasks = (bikeId: number) =>
  client.get<TaskWithStatus[]>(`/api/motorcycles/${bikeId}/tasks`).then((r) => r.data);

export const createTask = (bikeId: number, data: object) =>
  client.post<TaskWithStatus>(`/api/motorcycles/${bikeId}/tasks`, data).then((r) => r.data);

export const createTaskFromTemplate = (bikeId: number, templateId: number) =>
  client
    .post<TaskWithStatus>(`/api/motorcycles/${bikeId}/tasks/from-template`, { template_id: templateId })
    .then((r) => r.data);

export const updateTask = (id: number, data: object) =>
  client.put<TaskWithStatus>(`/api/tasks/${id}`, data).then((r) => r.data);

export const deleteTask = (id: number) =>
  client.delete(`/api/tasks/${id}`);
