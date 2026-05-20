import client from "./client";
import type { AppSettings } from "../types";

export const fetchSettings = () =>
  client.get<AppSettings>("/api/settings").then((r) => r.data);

export const updateSettings = (data: Partial<Pick<AppSettings, "default_unit" | "timezone">>) =>
  client.put<AppSettings>("/api/settings", data).then((r) => r.data);
