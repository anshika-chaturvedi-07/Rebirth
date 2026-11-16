export interface ImpactTotals {
  handovers: number;
  kg: number;
  co2e_kg: number;
  water_l: number;
  meals: number;
  car_km_avoided: number;
  tree_years: number;
}

export interface ImpactBreakdown {
  total: ImpactTotals;
  by_category: (ImpactTotals & { category: string; name: string; icon: string })[];
  by_month: (ImpactTotals & { month: string })[];
}

export interface CityImpact extends ImpactBreakdown {
  city: string;
  stages: { stage: "free" | "marketplace" | "recycle"; handovers: number; share: number }[];
  rehome_rate: number;
  neighbourhoods: { area: string; rehomed: number; listed: number; rehome_rate: number; free_share: number; kg: number; co2e_kg: number; circularity: number }[];
}

export interface MyImpact {
  given: ImpactBreakdown;
  received: ImpactBreakdown;
  delivered: ImpactBreakdown;
}

export interface Backtest {
  weeks: number;
  model: string;
  model_wape: number | null;
  naive_wape: number | null;
}

export interface CategoryForecast {
  category: string;
  name: string;
  icon: string;
  history: { week: string; supply: number; demand: number }[];
  forecast: { week: string; supply: number; supply_low: number; supply_high: number; demand: number; demand_low: number; demand_high: number }[];
  backtest: { supply: Backtest; demand: Backtest };
  model: { supply: string; demand: string };
  totals: { supply: number; demand: number };
  alert: { kind: "shortage" | "surplus"; message: string; gap_kg: number } | null;
}

export interface ForecastReport {
  city: string;
  horizon_weeks: number;
  generated_at: string;
  categories: CategoryForecast[];
  alerts: (NonNullable<CategoryForecast["alert"]> & { category: string; icon: string })[];
}

export interface HotspotCell {
  lat: number;
  lng: number;
  count: number;
  kg: number;
}
