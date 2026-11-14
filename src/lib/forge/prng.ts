export type Rng = () => number;

/** Deterministic PRNG so the sample dataset (and every hash over it) is reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const int = (rng: Rng, min: number, max: number) => Math.floor(between(rng, min, max + 1));
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
export const logn = (rng: Rng, median: number, sigma: number) => median * Math.exp(sigma * gauss(rng));

export function hex(rng: Rng, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += "0123456789abcdef"[Math.floor(rng() * 16)];
  return s;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58(rng: Rng, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += B58[Math.floor(rng() * B58.length)];
  return s;
}
