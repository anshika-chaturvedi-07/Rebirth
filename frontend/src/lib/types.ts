export type Role = "donor" | "organisation" | "individual" | "volunteer" | "business" | "recycler" | "admin";
export type Stage = "free" | "marketplace" | "recycle" | "expired";
export type Condition = "new" | "good" | "fair" | "needs_repair";

export interface User {
  id: number;
  role: Role;
  name: string;
  email: string;
  phone: string | null;
  city: string;
  verified: boolean;
  created_at: string;
}

export interface UserBrief {
  id: number;
  name: string;
  role: Role;
  verified: boolean;
}

export interface Category {
  slug: string;
  name: string;
  name_hi: string;
  icon: string;
  color: string;
  unit: "kg" | "items";
  priority_window_hours: number;
  perishable: boolean;
  subcategories: string[];
}

export interface Listing {
  id: number;
  title: string;
  description: string;
  category: string;
  subcategory: string | null;
  quantity: number;
  unit: string;
  condition: Condition;
  city: string;
  area: string;
  lat: number | null;
  lng: number | null;
  location_exact: boolean;
  distance_km: number | null;
  photos: string[];
  price_inr: number | null;
  status: "active" | "reserved" | "completed" | "withdrawn";
  stage: Stage;
  stage_ends_at: string | null;
  priority_until: string;
  marketplace_until: string;
  created_at: string;
  donor: UserBrief;
  claim_count: number;
  is_owner: boolean;
  my_claim_id: number | null;
  my_claim_status: ClaimStatus | null;
  my_delivery_status: DeliveryStatus | null;
  my_payment_status: "created" | "paid" | "failed" | "refunded" | null;
  review_claim_id: number | null;
  my_review_stars: number | null;
  can_claim: boolean;
  claim_blocked_reason: string | null;
}

export type ClaimStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

export interface Claim {
  id: number;
  listing_id: number;
  stage: Stage;
  message: string;
  status: ClaimStatus;
  created_at: string;
  claimant: UserBrief;
  need_id: number | null;
  wants_delivery: boolean;
  delivery_status: DeliveryStatus | null;
  payment_status: "created" | "paid" | "failed" | "refunded" | null;
}

export interface MyClaim extends Claim {
  listing_title: string;
  listing_category: string;
}

export interface Need {
  id: number;
  title: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  urgency: 1 | 2 | 3;
  city: string;
  area: string;
  lat: number | null;
  lng: number | null;
  location_exact: boolean;
  distance_km: number | null;
  needed_by: string | null;
  status: "open" | "fulfilled" | "closed";
  created_at: string;
  requester: UserBrief;
}

export type DeliveryStatus = "open" | "assigned" | "picked_up" | "delivered" | "cancelled";

export interface MatchBase {
  score: number;
  components: Record<string, number>;
  reasons: string[];
  distance_km: number | null;
}
export interface NeedMatch extends MatchBase {
  need: Need;
  listing_id: number;
  listing_title: string;
}
export interface ListingMatch extends MatchBase {
  listing: Listing;
}
export interface Suggestions {
  for_my_needs: ListingMatch[];
  for_my_items: NeedMatch[];
}

export interface DeliveryPlace {
  lat: number;
  lng: number;
  label: string;
}
export interface Delivery {
  id: number;
  status: DeliveryStatus;
  is_mine: boolean;
  item: string;
  category: string;
  quantity: number;
  unit: string;
  pickup: DeliveryPlace;
  dropoff: DeliveryPlace;
  trip_km: number;
  distance_km: number | null;
  created_at: string;
}
export interface RouteStop {
  task_id: number;
  kind: "pickup" | "dropoff";
  lat: number;
  lng: number;
  label: string;
  item: string;
  leg_km: number;
}
export interface PlannedRoute {
  stops: RouteStop[];
  task_ids: number[];
  total_km: number;
  minutes: number;
  solver: string;
  naive_km: number;
}
