import { createContext } from "react";

// Kept in its own module so editing the store during development does not create a second
// context object (which made consumers throw "must be used inside ForgeProvider").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ForgeContext = createContext<any>(null);
