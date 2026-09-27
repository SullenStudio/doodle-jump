import { BEST_KEY } from "./config.js";

// Pure localStorage read/write, kaplay-free so it stays importable from
// both scene modules and (potentially) tests.
export const getBest = () =>
  parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;

export const setBest = (v) => localStorage.setItem(BEST_KEY, String(v));
