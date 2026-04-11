/** Conditional logger — only emits in development builds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") console.log(...args);
};
