export type HairStyle = "short" | "messy" | "bun" | "curly" | "none";

export interface CharacterLook {
  skin: string;
  hair: string;
  style: HairStyle;
  shirt: string;
  hood?: boolean;
  chef?: boolean;
  bindi?: boolean;
  glasses?: boolean;
  cap?: string;
  mustache?: boolean;
  scarf?: string;
  wheelchair?: boolean;
}

export interface CastMember {
  id: CharacterId;
  name: string;
  nameHi: string;
  role: string;
  bg: string; // tailwind bg class
  line: string;
  look: CharacterLook;
}

export type CharacterId = "aarav" | "meera" | "kabir" | "dadi" | "ravi" | "fatima";

export const CAST: Record<CharacterId, CastMember> = {
  aarav: {
    id: "aarav", name: "Aarav", nameHi: "आरव", role: "Student · Receiver", bg: "bg-sky-t",
    line: "Got a free laptop for his coding classes. Now he tutors other kids on it.",
    look: { skin: "#C68863", hair: "#3A2418", style: "messy", shirt: "#6C8CFF", hood: true },
  },
  meera: {
    id: "meera", name: "Meera", nameHi: "मीरा", role: "Restaurant owner · Donor", bg: "bg-coral-t",
    line: "Lists her kitchen's surplus every night instead of throwing it away.",
    look: { skin: "#B97A56", hair: "#2B1A12", style: "bun", shirt: "#FF8C73", chef: true, bindi: true },
  },
  kabir: {
    id: "kabir", name: "Kabir", nameHi: "कबीर", role: "Artist · Repair hub", bg: "bg-lime-t",
    line: "Turns broken furniture and leftover paint into art for community spaces.",
    look: { skin: "#9C6644", hair: "#1E140F", style: "curly", shirt: "#74CCEC", wheelchair: true },
  },
  dadi: {
    id: "dadi", name: "Dadi", nameHi: "दादी", role: "Grandmother · Donor", bg: "bg-lavender-t",
    line: "Gave away her old sewing machine. It now earns a living for a women's co-op.",
    look: { skin: "#D59873", hair: "#ECE7F2", style: "bun", shirt: "#B39DF5", glasses: true, bindi: true },
  },
  ravi: {
    id: "ravi", name: "Ravi", nameHi: "रवि", role: "Volunteer driver", bg: "bg-butter-t",
    line: "Does 6 pickups every Sunday on routes REBIRTH plans for him.",
    look: { skin: "#8D5A3B", hair: "#20140E", style: "short", shirt: "#9ADB3C", cap: "#FF8C73", mustache: true },
  },
  fatima: {
    id: "fatima", name: "Ms. Fatima", nameHi: "फ़ातिमा", role: "Teacher · NGO partner", bg: "bg-blush-t",
    line: "Furnished two classrooms with chairs a tech office no longer needed.",
    look: { skin: "#C98F68", hair: "#2B1A12", style: "none", shirt: "#FFD66B", scarf: "#3FB8A8" },
  },
};

export const CAST_LIST = Object.values(CAST);
