import type {
  CateringPackage,
  Cuisine,
  CuratedBundle,
  Dish,
  Restaurant,
  Testimonial,
} from "./types";

/** Build an Unsplash URL from a verified photo id. */
const U = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// ---------------------------------------------------------------------------
// Cuisines
// ---------------------------------------------------------------------------
export const cuisines: Cuisine[] = [
  { key: "italian", label: "Italian", emoji: "🍝", color: "#d6266e", image: U("1606787366850-de6330128bfc", 500) },
  { key: "mexican", label: "Mexican", emoji: "🌮", color: "#e8431f", image: U("1565557623262-b51c2513a641", 500) },
  { key: "asian", label: "Asian", emoji: "🍜", color: "#6d28c9", image: U("1551183053-bf91a1d81141", 500) },
  { key: "healthy", label: "Healthy", emoji: "🥗", color: "#157a4e", image: U("1546069901-ba9599a7e63c", 500) },
  { key: "bbq", label: "BBQ", emoji: "🍖", color: "#ffb020", image: U("1593560708920-61dd98c46a4e", 500) },
  { key: "mediterranean", label: "Mediterranean", emoji: "🥙", color: "#0e7490", image: U("1607330289024-1535c6b4e1c1", 500) },
  { key: "indian", label: "Indian", emoji: "🍛", color: "#c2410c", image: U("1601050690597-df0568f70950", 500) },
  { key: "breakfast", label: "Breakfast", emoji: "🥐", color: "#f4a21e", image: U("1533089860892-a7c6f0a88666", 500) },
];

export const cuisineMap: Record<string, Cuisine> = Object.fromEntries(
  cuisines.map((c) => [c.key, c]),
);

// ---------------------------------------------------------------------------
// Restaurants
// ---------------------------------------------------------------------------
export const restaurants: Restaurant[] = [
  { id: "nonna", slug: "nonnas-table", name: "Nonna's Table", tagline: "Soulful family-style Italian", cuisine: "italian", rating: 4.9, reviews: 412, priceLevel: 2, prepTime: "24h notice", minOrder: 120, image: U("1473093295043-cdd812d0e601"), logoColor: "#d6266e", neighborhood: "North End", badges: ["Top Rated", "Office Favorite"], featured: true },
  { id: "slice", slug: "slice-society", name: "Slice Society", tagline: "Wood-fired pizzas by the crowd", cuisine: "italian", rating: 4.7, reviews: 289, priceLevel: 1, prepTime: "Same day", minOrder: 90, image: U("1513104890138-7c749659a591"), logoColor: "#e8431f", neighborhood: "Mission", badges: ["Fast Prep"], featured: true },
  { id: "fuego", slug: "el-fuego-taqueria", name: "El Fuego Taqueria", tagline: "Build-your-own taco fiestas", cuisine: "mexican", rating: 4.8, reviews: 521, priceLevel: 2, prepTime: "Same day", minOrder: 110, image: U("1565557623262-b51c2513a641"), logoColor: "#e8431f", neighborhood: "Mission", badges: ["Crowd Pleaser"], featured: true },
  { id: "sakura", slug: "sakura-ramen-house", name: "Sakura Ramen House", tagline: "Steamy ramen kits & dumplings", cuisine: "asian", rating: 4.8, reviews: 198, priceLevel: 2, prepTime: "24h notice", minOrder: 140, image: U("1551183053-bf91a1d81141"), logoColor: "#6d28c9", neighborhood: "Japantown", badges: ["New"], featured: true },
  { id: "dragon", slug: "dragon-wok", name: "Dragon Wok", tagline: "Sushi boats & wok classics", cuisine: "asian", rating: 4.6, reviews: 312, priceLevel: 2, prepTime: "Same day", minOrder: 130, image: U("1579584425555-c3ce17fd4351"), logoColor: "#6d28c9", neighborhood: "Downtown" },
  { id: "verde", slug: "verde-bowl-co", name: "Verde Bowl Co.", tagline: "Bright grain bowls & salads", cuisine: "healthy", rating: 4.9, reviews: 367, priceLevel: 2, prepTime: "Same day", minOrder: 95, image: U("1512621776951-a57141f2eefd"), logoColor: "#157a4e", neighborhood: "SoMa", badges: ["Healthiest", "Vegan-friendly"], featured: true },
  { id: "smoke", slug: "smokestack-bbq", name: "Smokestack BBQ", tagline: "Low-and-slow Texas brisket", cuisine: "bbq", rating: 4.7, reviews: 244, priceLevel: 3, prepTime: "48h notice", minOrder: 180, image: U("1593560708920-61dd98c46a4e"), logoColor: "#ffb020", neighborhood: "Dogpatch", badges: ["Premium"], featured: true },
  { id: "olive", slug: "olive-and-thyme", name: "Olive & Thyme", tagline: "Sunny Mediterranean mezze", cuisine: "mediterranean", rating: 4.8, reviews: 176, priceLevel: 2, prepTime: "Same day", minOrder: 100, image: U("1607330289024-1535c6b4e1c1"), logoColor: "#0e7490", neighborhood: "Hayes Valley" },
  { id: "saffron", slug: "saffron-spice-kitchen", name: "Saffron Spice Kitchen", tagline: "Aromatic Indian feasts", cuisine: "indian", rating: 4.9, reviews: 301, priceLevel: 2, prepTime: "24h notice", minOrder: 120, image: U("1601050690597-df0568f70950"), logoColor: "#c2410c", neighborhood: "Tenderloin", badges: ["Top Rated"] },
  { id: "sunrise", slug: "sunrise-brunch-club", name: "Sunrise Brunch Club", tagline: "All-day breakfast spreads", cuisine: "breakfast", rating: 4.7, reviews: 158, priceLevel: 1, prepTime: "Same day", minOrder: 80, image: U("1533089860892-a7c6f0a88666"), logoColor: "#f4a21e", neighborhood: "Marina" },
];

export const restaurantMap: Record<string, Restaurant> = Object.fromEntries(
  restaurants.map((r) => [r.id, r]),
);

// ---------------------------------------------------------------------------
// Dishes (group-sized trays). Each `serves` is [min,max] people.
// ---------------------------------------------------------------------------
export const dishes: Dish[] = [
  // Nonna's Table
  { id: "nonna-1", restaurantId: "nonna", name: "Rigatoni alla Vodka", description: "Creamy tomato-vodka sauce, fresh basil, shaved parmesan — baked in a family tray.", price: 78, serves: [8, 10], image: U("1606787366850-de6330128bfc"), cuisine: "italian", dietary: ["vegetarian"], category: "Pasta", popular: true },
  { id: "nonna-2", restaurantId: "nonna", name: "Chicken Parmigiana Tray", description: "Golden breaded cutlets, San Marzano marinara, melted mozzarella.", price: 96, serves: [8, 10], image: U("1555949258-eb67b1ef0ceb"), cuisine: "italian", dietary: [], category: "Mains" },
  { id: "nonna-3", restaurantId: "nonna", name: "Burrata & Caprese Platter", description: "Creamy burrata, heirloom tomatoes, basil, aged balsamic.", price: 64, serves: [10, 12], image: U("1540189549336-e6e99c3679fe"), cuisine: "italian", dietary: ["vegetarian", "gluten-free"], category: "Starters" },
  { id: "nonna-4", restaurantId: "nonna", name: "Tiramisu Cups (24)", description: "Espresso-soaked ladyfingers, mascarpone, cocoa dust. Individually portioned.", price: 72, serves: [20, 24], image: U("1559054663-e8d23213f55c"), cuisine: "italian", dietary: ["vegetarian"], category: "Dessert" },

  // Slice Society
  { id: "slice-1", restaurantId: "slice", name: "Margherita Party Box", description: "Three 18\" wood-fired pies, San Marzano, fresh mozzarella, basil.", price: 84, serves: [10, 14], image: U("1513104890138-7c749659a591"), cuisine: "italian", dietary: ["vegetarian"], category: "Pizza", popular: true },
  { id: "slice-2", restaurantId: "slice", name: "Pepperoni Crowd Pies", description: "Three loaded pepperoni pies with hot honey on the side.", price: 90, serves: [10, 14], image: U("1565299624946-b28f40a0ae38"), cuisine: "italian", dietary: [], category: "Pizza" },
  { id: "slice-3", restaurantId: "slice", name: "Garden Antipasto Salad", description: "Crisp romaine, salami, provolone, pepperoncini, red-wine vinaigrette.", price: 52, serves: [10, 12], image: U("1565958011703-44f9829ba187"), cuisine: "italian", dietary: [], category: "Salad" },
  { id: "slice-4", restaurantId: "slice", name: "Garlic Knot Mountain", description: "Two dozen buttery garlic knots with warm marinara.", price: 34, serves: [12, 16], image: U("1574071318508-1cdbab80d002"), cuisine: "italian", dietary: ["vegetarian"], category: "Sides", isNew: true },

  // El Fuego Taqueria
  { id: "fuego-1", restaurantId: "fuego", name: "Build-Your-Own Taco Bar", description: "Carne asada, al pastor & grilled veggies with all the fixings and warm tortillas.", price: 128, serves: [12, 15], image: U("1565557623262-b51c2513a641"), cuisine: "mexican", dietary: ["gluten-free"], category: "Mains", popular: true },
  { id: "fuego-2", restaurantId: "fuego", name: "Carne Asada Burrito Box", description: "Ten foil-wrapped burritos: marinated steak, rice, beans, salsa verde.", price: 98, serves: [10, 10], image: U("1599974579688-8dbdd335c77f"), cuisine: "mexican", dietary: [], category: "Mains" },
  { id: "fuego-3", restaurantId: "fuego", name: "Loaded Nacho Tray", description: "Crispy chips, queso, black beans, pico, jalapeños, crema.", price: 56, serves: [10, 12], image: U("1551504734-5ee1c4a1479b"), cuisine: "mexican", dietary: ["vegetarian"], category: "Sides", isNew: true },
  { id: "fuego-4", restaurantId: "fuego", name: "Chips, Guac & Salsa Trio", description: "House guac, roasted salsa, mango salsa & a mountain of warm chips.", price: 38, serves: [12, 16], image: U("1467003909585-2f8a72700288"), cuisine: "mexican", dietary: ["vegan", "gluten-free"], category: "Sides" },

  // Sakura Ramen House
  { id: "sakura-1", restaurantId: "sakura", name: "Tonkotsu Ramen Kit", description: "Rich pork broth, fresh noodles, chashu & toppings — assemble at the table.", price: 132, serves: [8, 10], image: U("1551183053-bf91a1d81141"), cuisine: "asian", dietary: [], category: "Ramen", popular: true },
  { id: "sakura-2", restaurantId: "sakura", name: "Shoyu Ramen Kit", description: "Soy-based chicken broth, soft egg, scallion, bamboo shoots.", price: 124, serves: [8, 10], image: U("1569718212165-3a8278d5f624"), cuisine: "asian", dietary: [], category: "Ramen" },
  { id: "sakura-3", restaurantId: "sakura", name: "Gyoza Dumpling Platter", description: "Forty pan-fried pork & vegetable dumplings with ponzu dip.", price: 60, serves: [10, 12], image: U("1432139555190-58524dae6a55"), cuisine: "asian", dietary: [], category: "Starters" },
  { id: "sakura-4", restaurantId: "sakura", name: "Edamame & Seaweed Salad", description: "Sea-salt edamame and sesame seaweed salad — light and bright.", price: 36, serves: [10, 12], image: U("1490645935967-10de6ba17061"), cuisine: "asian", dietary: ["vegan", "gluten-free"], category: "Sides" },

  // Dragon Wok
  { id: "dragon-1", restaurantId: "dragon", name: "Dragon Roll Sushi Boat", description: "Chef's selection of 64 pieces: dragon, rainbow, spicy tuna & veggie rolls.", price: 168, serves: [10, 14], image: U("1579584425555-c3ce17fd4351"), cuisine: "asian", dietary: [], category: "Sushi", popular: true },
  { id: "dragon-2", restaurantId: "dragon", name: "Rainbow Sashimi Platter", description: "Premium salmon, tuna & yellowtail over crushed ice.", price: 142, serves: [8, 10], image: U("1611143669185-af224c5e3252"), cuisine: "asian", dietary: ["gluten-free"], category: "Sushi" },
  { id: "dragon-3", restaurantId: "dragon", name: "Kung Pao Chicken Tray", description: "Wok-tossed chicken, peanuts, dried chili, bell peppers.", price: 74, serves: [8, 10], image: U("1559339352-11d035aa65de"), cuisine: "asian", dietary: ["spicy"], category: "Mains" },
  { id: "dragon-4", restaurantId: "dragon", name: "Veggie Fried Rice Tub", description: "Wok rice with egg, peas, carrot & scallion. A reliable crowd base.", price: 48, serves: [12, 14], image: U("1482049016688-2d3e1b311543"), cuisine: "asian", dietary: ["vegetarian"], category: "Sides" },

  // Verde Bowl Co.
  { id: "verde-1", restaurantId: "verde", name: "Harvest Grain Bowl Bar", description: "Quinoa, farro, roasted veg, three proteins & six dressings — fully build-your-own.", price: 118, serves: [10, 14], image: U("1512621776951-a57141f2eefd"), cuisine: "healthy", dietary: ["gluten-free"], category: "Bowls", popular: true },
  { id: "verde-2", restaurantId: "verde", name: "Citrus Kale Caesar", description: "Lacinato kale, shaved parm, sourdough croutons, lemony caesar.", price: 54, serves: [10, 12], image: U("1546069901-ba9599a7e63c"), cuisine: "healthy", dietary: ["vegetarian"], category: "Salad" },
  { id: "verde-3", restaurantId: "verde", name: "Rainbow Crudité Box", description: "Heirloom carrots, radish, cucumber, snap peas with green-goddess dip.", price: 44, serves: [12, 16], image: U("1493770348161-369560ae357d"), cuisine: "healthy", dietary: ["vegan", "gluten-free"], category: "Sides" },
  { id: "verde-4", restaurantId: "verde", name: "Açaí & Berry Cups (16)", description: "Açaí blend, granola, banana, mixed berries — individually packed.", price: 68, serves: [14, 16], image: U("1484980972926-edee96e0960d"), cuisine: "healthy", dietary: ["vegan"], category: "Dessert", isNew: true },

  // Smokestack BBQ
  { id: "smoke-1", restaurantId: "smoke", name: "Brisket & Burnt Ends Tray", description: "16-hour smoked brisket and caramelized burnt ends with house BBQ sauce.", price: 188, serves: [10, 12], image: U("1593560708920-61dd98c46a4e"), cuisine: "bbq", dietary: ["gluten-free"], category: "Mains", popular: true },
  { id: "smoke-2", restaurantId: "smoke", name: "Pulled Pork Slider Stack", description: "Two dozen slow-smoked pulled-pork sliders with slaw and pickles.", price: 96, serves: [12, 14], image: U("1568901346375-23c9450c58cd"), cuisine: "bbq", dietary: [], category: "Mains" },
  { id: "smoke-3", restaurantId: "smoke", name: "Smoked Mac & Cheese", description: "Three-cheese mac with a smoky breadcrumb crust.", price: 58, serves: [10, 14], image: U("1504674900247-0877df9cc836"), cuisine: "bbq", dietary: ["vegetarian"], category: "Sides", popular: true },
  { id: "smoke-4", restaurantId: "smoke", name: "Cornbread & Slaw Combo", description: "Honey-butter cornbread squares with tangy buttermilk slaw.", price: 42, serves: [12, 16], image: U("1559847844-5315695dadae"), cuisine: "bbq", dietary: ["vegetarian"], category: "Sides" },

  // Olive & Thyme
  { id: "olive-1", restaurantId: "olive", name: "Mezze Grazing Board", description: "Hummus, baba ganoush, olives, dolmas, feta, warm pita & crudité.", price: 92, serves: [12, 16], image: U("1607330289024-1535c6b4e1c1"), cuisine: "mediterranean", dietary: ["vegetarian"], category: "Starters", popular: true },
  { id: "olive-2", restaurantId: "olive", name: "Chicken Shawarma Platter", description: "Marinated chicken, saffron rice, garlic toum, pickled turnips.", price: 104, serves: [10, 12], image: U("1546793665-c74683f339c1"), cuisine: "mediterranean", dietary: ["gluten-free"], category: "Mains" },
  { id: "olive-3", restaurantId: "olive", name: "Falafel & Hummus Box", description: "Crispy herb falafel, creamy hummus, tahini & fresh salad.", price: 62, serves: [10, 12], image: U("1432139555190-58524dae6a55"), cuisine: "mediterranean", dietary: ["vegan"], category: "Mains" },
  { id: "olive-4", restaurantId: "olive", name: "Greek Village Salad", description: "Tomato, cucumber, red onion, kalamata & feta in oregano vinaigrette.", price: 50, serves: [10, 12], image: U("1540189549336-e6e99c3679fe"), cuisine: "mediterranean", dietary: ["vegetarian", "gluten-free"], category: "Salad" },

  // Saffron Spice Kitchen
  { id: "saffron-1", restaurantId: "saffron", name: "Butter Chicken Feast", description: "Velvety tomato-butter curry with basmati rice & garlic naan.", price: 112, serves: [10, 12], image: U("1601050690597-df0568f70950"), cuisine: "indian", dietary: ["gluten-free"], category: "Mains", popular: true },
  { id: "saffron-2", restaurantId: "saffron", name: "Vegetarian Thali Spread", description: "Dal makhani, paneer, chana masala, rice, naan & raita.", price: 98, serves: [10, 12], image: U("1631452180519-c014fe946bc7"), cuisine: "indian", dietary: ["vegetarian"], category: "Mains" },
  { id: "saffron-3", restaurantId: "saffron", name: "Tandoori Mixed Grill", description: "Tandoori chicken, seekh kebab & paneer tikka with mint chutney.", price: 124, serves: [10, 12], image: U("1585937421612-70a008356fbe"), cuisine: "indian", dietary: ["gluten-free", "spicy"], category: "Mains" },
  { id: "saffron-4", restaurantId: "saffron", name: "Samosa & Chaat Box", description: "Two dozen samosas with tamarind & mint chutneys plus papdi chaat.", price: 52, serves: [12, 14], image: U("1601050690597-df0568f70950"), cuisine: "indian", dietary: ["vegetarian"], category: "Starters" },

  // Sunrise Brunch Club
  { id: "sunrise-1", restaurantId: "sunrise", name: "Build-Your-Own Bagel Bar", description: "Two dozen bagels, three cream cheeses, lox, tomato, capers & onion.", price: 86, serves: [12, 16], image: U("1525351484163-7529414344d8"), cuisine: "breakfast", dietary: ["vegetarian"], category: "Breakfast", popular: true },
  { id: "sunrise-2", restaurantId: "sunrise", name: "Pancake & Berry Stack", description: "Fluffy buttermilk pancakes, maple syrup, whipped butter & berries.", price: 64, serves: [10, 12], image: U("1484980972926-edee96e0960d"), cuisine: "breakfast", dietary: ["vegetarian"], category: "Breakfast" },
  { id: "sunrise-3", restaurantId: "sunrise", name: "Avocado Toast Flight", description: "Sourdough toasts with smashed avo, chili crisp, radish & feta.", price: 58, serves: [8, 10], image: U("1517248135467-4c7edcad34c4"), cuisine: "breakfast", dietary: ["vegetarian"], category: "Breakfast", isNew: true },
  { id: "sunrise-4", restaurantId: "sunrise", name: "Fruit & Yogurt Parfaits (16)", description: "Greek yogurt, granola & seasonal fruit in grab-and-go cups.", price: 56, serves: [14, 16], image: U("1414235077428-338989a2e8c0"), cuisine: "breakfast", dietary: ["vegetarian", "gluten-free"], category: "Breakfast" },
];

export const dishMap: Record<string, Dish> = Object.fromEntries(
  dishes.map((d) => [d.id, d]),
);

export const dishesByRestaurant = (restaurantId: string) =>
  dishes.filter((d) => d.restaurantId === restaurantId);

// ---------------------------------------------------------------------------
// Curated multi-restaurant bundles
// ---------------------------------------------------------------------------
export const bundles: CuratedBundle[] = [
  {
    id: "b-world", slug: "around-the-world-lunch", name: "Around the World Lunch",
    tagline: "Four cuisines, one delivery", theme: "Global",
    description: "Can't agree on a cuisine? Don't. This crowd-pleaser bundles a taco bar, ramen kits, butter chicken and a grain-bowl bar from four local kitchens into a single drop-off.",
    serves: 14, pricePerPerson: 24, image: U("1504674900247-0877df9cc836"),
    dishIds: ["fuego-1", "sakura-1", "saffron-1", "verde-1"], tags: ["Most Popular", "4 restaurants", "Crowd-pleaser"], popular: true,
  },
  {
    id: "b-fiesta", slug: "office-taco-fiesta", name: "Office Taco Fiesta",
    tagline: "Taco Tuesday, handled", theme: "Mexican",
    description: "A build-your-own taco bar, loaded nachos, chips-and-guac and a bright kale caesar to keep it balanced.",
    serves: 15, pricePerPerson: 18, image: U("1565557623262-b51c2513a641"),
    dishIds: ["fuego-1", "fuego-3", "fuego-4", "verde-2"], tags: ["3 restaurants", "Vegetarian options"], popular: true,
  },
  {
    id: "b-pasta", slug: "pasta-night-social", name: "Pasta Night Social",
    tagline: "Cozy Italian comfort", theme: "Italian",
    description: "Baked rigatoni, a margherita party box, antipasto salad and tiramisu cups for the win.",
    serves: 14, pricePerPerson: 19, image: U("1473093295043-cdd812d0e601"),
    dishIds: ["nonna-1", "slice-1", "slice-3", "nonna-4"], tags: ["2 restaurants", "Dessert included"],
  },
  {
    id: "b-reset", slug: "healthy-team-reset", name: "Healthy Team Reset",
    tagline: "Bright, fresh & feel-good", theme: "Healthy",
    description: "A grain-bowl bar, citrus kale caesar, rainbow crudité and açaí cups — light enough for an afternoon of deep work.",
    serves: 14, pricePerPerson: 17, image: U("1512621776951-a57141f2eefd"),
    dishIds: ["verde-1", "verde-2", "verde-3", "verde-4"], tags: ["Vegan options", "Gluten-free options"],
  },
  {
    id: "b-bbq", slug: "bbq-backyard-bash", name: "BBQ Backyard Bash",
    tagline: "Smoky, hearty, celebratory", theme: "BBQ",
    description: "Brisket and burnt ends, pulled-pork sliders, smoked mac and cornbread with slaw — bring the napkins.",
    serves: 14, pricePerPerson: 27, image: U("1593560708920-61dd98c46a4e"),
    dishIds: ["smoke-1", "smoke-2", "smoke-3", "smoke-4"], tags: ["Premium", "Team celebration"],
  },
  {
    id: "b-breakfast", slug: "sunrise-standup-breakfast", name: "Sunrise Standup Breakfast",
    tagline: "Fuel the morning standup", theme: "Breakfast",
    description: "A bagel bar, pancake stack, breakfast classics and fruit-yogurt parfaits to start the day right.",
    serves: 16, pricePerPerson: 14, image: U("1533089860892-a7c6f0a88666"),
    dishIds: ["sunrise-1", "sunrise-2", "sunrise-3", "verde-4"], tags: ["2 restaurants", "Early delivery"],
  },
];

export const bundleMap: Record<string, CuratedBundle> = Object.fromEntries(
  bundles.map((b) => [b.id, b]),
);

/** Distinct restaurants represented inside a bundle. */
export const bundleRestaurants = (b: CuratedBundle): Restaurant[] => {
  const ids = Array.from(new Set(b.dishIds.map((id) => dishMap[id]?.restaurantId).filter(Boolean)));
  return ids.map((id) => restaurantMap[id as string]).filter(Boolean);
};

// ---------------------------------------------------------------------------
// Configurable catering packages ("order by package")
// ---------------------------------------------------------------------------
export const packages: CateringPackage[] = [
  {
    id: "pkg-indian", slug: "indian-feast-package", name: "Indian Feast Package",
    tagline: "Build your own Indian spread", theme: "Indian", cuisine: "indian", minGuests: 20,
    image: U("1601050690597-df0568f70950"),
    description: "A fully customizable Indian feast — choose your mains, a starter and a fresh side. Sized to your headcount and pulled from the city's best kitchens.",
    sections: [
      { name: "Mains", maxSelections: 2, options: [{ dishId: "saffron-1" }, { dishId: "saffron-2" }, { dishId: "saffron-3" }] },
      { name: "Starter", maxSelections: 1, options: [{ dishId: "saffron-4" }, { dishId: "olive-1" }] },
      { name: "Fresh side", maxSelections: 1, options: [{ dishId: "verde-3" }, { dishId: "olive-4" }] },
    ],
    popular: true,
  },
  {
    id: "pkg-taco", slug: "taco-bar-package", name: "Taco Bar Package",
    tagline: "A fiesta, your way", theme: "Mexican", cuisine: "mexican", minGuests: 15,
    image: U("1565557623262-b51c2513a641"),
    description: "Pick your main taco bar, a couple of sides and a sweet finish. Crowd-pleasing and endlessly customizable.",
    sections: [
      { name: "Main", maxSelections: 1, options: [{ dishId: "fuego-1" }, { dishId: "fuego-2" }] },
      { name: "Sides", maxSelections: 2, options: [{ dishId: "fuego-3" }, { dishId: "fuego-4" }, { dishId: "verde-2" }] },
      { name: "Dessert", maxSelections: 1, options: [{ dishId: "verde-4" }, { dishId: "nonna-4" }] },
    ],
    popular: true,
  },
  {
    id: "pkg-italian", slug: "italian-dinner-package", name: "Italian Dinner Package",
    tagline: "Cozy Italian, customized", theme: "Italian", cuisine: "italian", minGuests: 12,
    image: U("1473093295043-cdd812d0e601"),
    description: "Choose two pasta or pizza mains, a starter and a dessert from two beloved Italian kitchens.",
    sections: [
      { name: "Mains", maxSelections: 2, options: [{ dishId: "nonna-1" }, { dishId: "nonna-2" }, { dishId: "slice-1" }, { dishId: "slice-2" }] },
      { name: "Starter", maxSelections: 1, options: [{ dishId: "nonna-3" }, { dishId: "slice-3" }, { dishId: "slice-4" }] },
      { name: "Dessert", maxSelections: 1, options: [{ dishId: "nonna-4" }] },
    ],
  },
  {
    id: "pkg-healthy", slug: "healthy-lunch-package", name: "Healthy Lunch Package",
    tagline: "Bright, fresh, feel-good", theme: "Healthy", cuisine: "healthy", minGuests: 10,
    image: U("1512621776951-a57141f2eefd"),
    description: "A grain-bowl bar, your pick of salad, a crunchy side and a light dessert. Deep-work fuel for the team.",
    sections: [
      { name: "Bowl bar", maxSelections: 1, options: [{ dishId: "verde-1" }] },
      { name: "Salad", maxSelections: 1, options: [{ dishId: "verde-2" }, { dishId: "olive-4" }] },
      { name: "Side", maxSelections: 1, options: [{ dishId: "verde-3" }, { dishId: "sakura-4" }] },
      { name: "Dessert", maxSelections: 1, options: [{ dishId: "verde-4" }] },
    ],
  },
];

export const packageMap: Record<string, CateringPackage> = Object.fromEntries(
  packages.map((p) => [p.slug, p]),
);

/** Distinct restaurants represented across a package's options. */
export const packageRestaurants = (p: CateringPackage): Restaurant[] => {
  const ids = Array.from(
    new Set(
      p.sections.flatMap((s) => s.options.map((o) => dishMap[o.dishId]?.restaurantId)).filter(Boolean),
    ),
  );
  return ids.map((id) => restaurantMap[id as string]).filter(Boolean);
};

// ---------------------------------------------------------------------------
// Testimonials & marketing copy
// ---------------------------------------------------------------------------
export const testimonials: Testimonial[] = [
  { id: "t1", quote: "We feed 60 people every Thursday from four different restaurants and it shows up as one delivery, one invoice. Dinner Rush saved my sanity.", name: "Priya Natarajan", role: "Office Experience Lead", company: "Loftworks", avatarColor: "#d6266e", rating: 5 },
  { id: "t2", quote: "The headcount bar is genius — I finally stop over- or under-ordering. Everyone gets fed and there's barely any waste.", name: "Marcus Bell", role: "Executive Assistant", company: "Northwind Capital", avatarColor: "#6d28c9", rating: 5 },
  { id: "t3", quote: "Mixing sushi, tacos and a salad bar in one order made our 'no one can agree on lunch' problem disappear overnight.", name: "Sofia Alvarez", role: "People Ops Manager", company: "Brightline", avatarColor: "#157a4e", rating: 5 },
  { id: "t4", quote: "Set up a recurring Friday bundle in two minutes. The team thinks I'm a hero and honestly I'll take it.", name: "Danielle Wu", role: "Chief of Staff", company: "Cedar & Co.", avatarColor: "#e8431f", rating: 5 },
];

export const howItWorks = [
  { step: 1, title: "Set your headcount", body: "Tell us how many people you're feeding. We size every dish and keep a live coverage meter so nobody goes hungry.", emoji: "👥" },
  { step: 2, title: "Mix & match restaurants", body: "Add dishes from as many local kitchens as you like into a single bundle — tacos here, sushi there, salad to balance.", emoji: "🧺" },
  { step: 3, title: "Schedule one delivery", body: "Pick a date and time. Everything arrives together, labeled and set up — on one invoice.", emoji: "🚚" },
  { step: 4, title: "Gather & enjoy", body: "Your team digs into a spread from the city's best spots. You look like a hero. Easy.", emoji: "🎉" },
];

export const stats = [
  { value: "2,400+", label: "offices fed monthly" },
  { value: "120", label: "local restaurants" },
  { value: "1", label: "invoice, always" },
  { value: "4.9★", label: "average rating" },
];

export const featuredRestaurants = restaurants.filter((r) => r.featured);
export const popularDishes = dishes.filter((d) => d.popular);
