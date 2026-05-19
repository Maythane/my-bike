import client from "./client";
import type { Profile } from "../types";

export const getProfiles = () => client.get<Profile[]>("/api/profiles").then((r) => r.data);

export const createProfile = (data: Partial<Profile>) =>
  client.post<Profile>("/api/profiles", data).then((r) => r.data);

export const updateProfile = (id: number, data: Partial<Profile>) =>
  client.put<Profile>(`/api/profiles/${id}`, data).then((r) => r.data);

export const deleteProfile = (id: number) =>
  client.delete(`/api/profiles/${id}`);

export const exportProfile = (id: number) =>
  client.get(`/api/profiles/${id}/export`).then((r) => r.data);
