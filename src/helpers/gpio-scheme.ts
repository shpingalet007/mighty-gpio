import { ReverseMap } from "../types/types";

export const BroadcomScheme = {
  2: 3,
  3: 5,
  4: 7,
  5: 29,
  6: 31,
  7: 26,
  8: 24,
  9: 21,
  10: 19,
  11: 23,
  12: 32,
  13: 33,
  14: 8,
  15: 10,
  16: 36,
  17: 11,
  18: 12,
  19: 35,
  20: 38,
  21: 40,
  22: 15,
  23: 16,
  24: 18,
  25: 22,
  26: 37,
  27: 13,
};

export const PhysicalScheme = (<unknown>(
  Object.fromEntries(
    Object.entries(BroadcomScheme).map(([key, value]) => [value, key]),
  )
)) as ReverseMap<typeof BroadcomScheme>;
