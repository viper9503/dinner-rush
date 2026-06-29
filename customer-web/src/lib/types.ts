export type CuisineKey =
  | "italian"
  | "mexican"
  | "asian"
  | "healthy"
  | "bbq"
  | "mediterranean"
  | "breakfast"
  | "indian";

export interface Cuisine {
  key: CuisineKey;
  label: string;
  emoji: string;
  /** hex used for the cuisine-coded left rail + chips */
  color: string;
  image: string;
}

export type DietaryTag = "vegetarian" | "vegan" | "gluten-free" | "spicy" | "dairy-free";

export interface Dish {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  /** price for the whole tray/platter (group-sized) */
  price: number;
  /** [min,max] people one tray serves */
  serves: [number, number];
  image: string;
  cuisine: CuisineKey;
  dietary: DietaryTag[];
  popular?: boolean;
  isNew?: boolean;
  /** section within the restaurant menu, e.g. "Mains", "Sides" */
  category: string;
}

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  cuisine: CuisineKey;
  rating: number;
  reviews: number;
  priceLevel: 1 | 2 | 3;
  prepTime: string;
  minOrder: number;
  image: string;
  logoColor: string;
  neighborhood: string;
  badges?: string[];
  featured?: boolean;
}

export interface CuratedBundle {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  serves: number;
  /** price-per-person headline */
  pricePerPerson: number;
  image: string;
  theme: string;
  /** dish ids included in the bundle (spanning multiple restaurants) */
  dishIds: string[];
  tags: string[];
  popular?: boolean;
}

/** A configurable catering package: the OLD app's "order by package" mode.
 *  Each section lets the guest pick up to `maxSelections` options, and every
 *  option points at a real dish so configuring a package just adds dish line
 *  items to the cart (sized by guest count) and flows through the same pipeline. */
export interface PackageOption {
  dishId: string;
  /** Optional display label; falls back to the dish name. */
  label?: string;
}

export interface PackageSection {
  name: string;
  /** How many options a guest may choose from this section. */
  maxSelections: number;
  options: PackageOption[];
}

export interface CateringPackage {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  image: string;
  theme: string;
  cuisine: CuisineKey;
  minGuests: number;
  sections: PackageSection[];
  popular?: boolean;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  company: string;
  avatarColor: string;
  rating: number;
}

export interface CartItem {
  dishId: string;
  qty: number;
}
