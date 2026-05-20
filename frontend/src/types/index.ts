export type UnitEnum = "km" | "miles";
export type PriorityEnum = "low" | "medium" | "high";
export type StatusLabel = "good" | "due_soon" | "overdue";

export interface AppSettings {
  id: number;
  default_unit: UnitEnum;
  timezone: string;
  app_version: string;
}

export interface Profile {
  id: number;
  name: string;
  icon: string;
  color_accent: string;
  unit: UnitEnum | null;
  created_at: string;
}

export interface Motorcycle {
  id: number;
  profile_id: number;
  make: string;
  model: string;
  year: number;
  nickname: string | null;
  color: string | null;
  license_plate: string | null;
  registration_year: number | null;
  engine_cc: number | null;
  tank_capacity: number | null;
  current_mileage: number;
  mileage_unit: UnitEnum | null;
  image_path: string | null;
  created_at: string;
}

export interface TaskWithStatus {
  id: number;
  motorcycle_id: number;
  name: string;
  interval_km: number | null;
  interval_months: number | null;
  priority: PriorityEnum;
  is_active: boolean;
  notes: string | null;
  status_score: number;
  status_label: StatusLabel;
  last_service_date: string | null;
  last_service_km: number | null;
  km_until_due: number | null;
  days_until_due: number | null;
}

export interface LogImage {
  id: number;
  image_path: string;
}

export interface ServiceLog {
  id: number;
  task_id: number;
  name: string;
  date_performed: string;
  mileage_at_service: number;
  cost: number | null;
  location: string | null;
  notes: string | null;
  images: LogImage[];
  created_at: string;
}

export interface FuelLog {
  id: number;
  motorcycle_id: number;
  date: string;
  mileage_at_fillup: number;
  fuel_amount: number;
  fuel_type: string;
  is_full_tank: boolean;
  cost: number | null;
  location: string | null;
  notes: string | null;
  images: LogImage[];
  km_per_liter: number | null;
  distance_km: number | null;
  created_at: string;
}

export interface FuelEconomy {
  avg_km_per_liter: number | null;
  last_km_per_liter: number | null;
  best_km_per_liter: number | null;
  total_fuel: number;
  total_cost: number | null;
  total_logs: number;
}

export interface TaskTemplate {
  id: number;
  name: string;
  model: string | null;
  default_interval_km: number | null;
  default_interval_months: number | null;
  category: string;
}

export interface ShockBrand {
  id: number;
  name: string;
  accent_color: string;
  banner_bg_color: string;
  header_image_url: string | null;
  shock_models: string[];
}

export interface ShockSetting {
  id: number;
  motorcycle_id: number | null;
  user_id: number | null;
  rider_weight: number;
  passenger_weight: number;
  mode: string;
  shock_brand: string | null;
  shock_model: string | null;
}
