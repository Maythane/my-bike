import client from "./client";
import type { ShockBrand } from "../types";

export const fetchShockBrands = () =>
  client.get<ShockBrand[]>("/api/shock-brands").then((r) => r.data);
