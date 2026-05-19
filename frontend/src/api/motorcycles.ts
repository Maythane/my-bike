import client from "./client";
import type { Motorcycle } from "../types";

export const getAllMotorcycles = () =>
  client.get<Motorcycle[]>(`/api/motorcycles`).then((r) => r.data);

export const getMotorcycles = (profileId: number) =>
  client.get<Motorcycle[]>(`/api/profiles/${profileId}/motorcycles`).then((r) => r.data);

export const getMotorcycle = (id: number) =>
  client.get<Motorcycle>(`/api/motorcycles/${id}`).then((r) => r.data);

export const createMotorcycle = (profileId: number, data: Partial<Motorcycle>) =>
  client.post<Motorcycle>(`/api/profiles/${profileId}/motorcycles`, data).then((r) => r.data);

export const createMotorcycleSimple = (data: Partial<Motorcycle>) =>
  client.post<Motorcycle>(`/api/motorcycles`, data).then((r) => r.data);

export const updateMotorcycle = (id: number, data: Partial<Motorcycle>) =>
  client.put<Motorcycle>(`/api/motorcycles/${id}`, data).then((r) => r.data);

export const uploadBikeImage = (id: number, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post<Motorcycle>(`/api/motorcycles/${id}/image`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);
};

export const deleteBikeImage = (id: number) =>
  client.delete<Motorcycle>(`/api/motorcycles/${id}/image`).then((r) => r.data);

export const deleteMotorcycle = (id: number) =>
  client.delete(`/api/motorcycles/${id}`);
