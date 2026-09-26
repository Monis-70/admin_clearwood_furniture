/** A shared input type with its `Date` fields as the ISO strings sent over the wire. */
export type Dated<T> = {
  [K in keyof T]: T[K] extends Date | null | undefined ? string | null | undefined : T[K];
};
