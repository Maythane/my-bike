import client from "./client";
import type { TaskTemplate } from "../types";

export const getTemplates = () =>
  client.get<TaskTemplate[]>("/api/templates").then((r) => r.data);
