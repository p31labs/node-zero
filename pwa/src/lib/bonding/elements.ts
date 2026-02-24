export interface Element {
  symbol: string;
  name: string;
  number: number;
  mass: number;
  valence: number;
  color: string;
  radius: number;
  category: "nonmetal" | "metal" | "metalloid" | "noble";
  fact: string;
}

export const ELEMENTS: Element[] = [
  { symbol: "H", name: "Hydrogen", number: 1, mass: 1.008, valence: 1, color: "#FFFFFF", radius: 18, category: "nonmetal", fact: "Lightest thing. You are mostly hydrogen." },
  { symbol: "He", name: "Helium", number: 2, mass: 4.003, valence: 0, color: "#D4E4FF", radius: 20, category: "noble", fact: "Refuses to bond." },
  { symbol: "C", name: "Carbon", number: 6, mass: 12.011, valence: 4, color: "#7A7A7A", radius: 22, category: "nonmetal", fact: "Backbone of life." },
  { symbol: "N", name: "Nitrogen", number: 7, mass: 14.007, valence: 3, color: "#758CFF", radius: 21, category: "nonmetal", fact: "78 percent of every breath." },
  { symbol: "O", name: "Oxygen", number: 8, mass: 15.999, valence: 2, color: "#FF4D4D", radius: 21, category: "nonmetal", fact: "You breathe this." },
  { symbol: "F", name: "Fluorine", number: 9, mass: 18.998, valence: 1, color: "#90E050", radius: 19, category: "nonmetal", fact: "Most reactive." },
  { symbol: "Na", name: "Sodium", number: 11, mass: 22.99, valence: 1, color: "#AB5CF2", radius: 24, category: "metal", fact: "With chlorine, table salt." },
  { symbol: "Mg", name: "Magnesium", number: 12, mass: 24.305, valence: 2, color: "#8AFF00", radius: 24, category: "metal", fact: "Burns bright." },
  { symbol: "Al", name: "Aluminum", number: 13, mass: 26.982, valence: 3, color: "#BFA6A6", radius: 24, category: "metal", fact: "Wraps leftovers." },
  { symbol: "Si", name: "Silicon", number: 14, mass: 28.086, valence: 4, color: "#F0C8A0", radius: 23, category: "metalloid", fact: "Computer chips." },
  { symbol: "P", name: "Phosphorus", number: 15, mass: 30.974, valence: 3, color: "#39FF14", radius: 22, category: "nonmetal", fact: "Element 15. The namesake." },
  { symbol: "S", name: "Sulfur", number: 16, mass: 32.065, valence: 2, color: "#FFFF30", radius: 22, category: "nonmetal", fact: "Your body needs it." },
  { symbol: "Cl", name: "Chlorine", number: 17, mass: 35.453, valence: 1, color: "#1FF01F", radius: 22, category: "nonmetal", fact: "With sodium, salt." },
  { symbol: "K", name: "Potassium", number: 19, mass: 39.098, valence: 1, color: "#8F40D4", radius: 26, category: "metal", fact: "Bananas." },
  { symbol: "Ca", name: "Calcium", number: 20, mass: 40.078, valence: 2, color: "#00D4FF", radius: 26, category: "metal", fact: "Your bones." },
  { symbol: "Fe", name: "Iron", number: 26, mass: 55.845, valence: 3, color: "#E06633", radius: 24, category: "metal", fact: "Blood is red." },
  { symbol: "Cu", name: "Copper", number: 29, mass: 63.546, valence: 2, color: "#C88033", radius: 23, category: "metal", fact: "Statue of Liberty." },
  { symbol: "Zn", name: "Zinc", number: 30, mass: 65.38, valence: 2, color: "#7D80B0", radius: 23, category: "metal", fact: "Immune system." },
  { symbol: "Br", name: "Bromine", number: 35, mass: 79.904, valence: 1, color: "#A62929", radius: 23, category: "nonmetal", fact: "Liquid at room temp." },
  { symbol: "Au", name: "Gold", number: 79, mass: 196.967, valence: 1, color: "#FFD123", radius: 24, category: "metal", fact: "Sovereign." },
];
