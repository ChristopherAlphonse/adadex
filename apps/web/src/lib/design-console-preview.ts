export const isDesignConsolePreview = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("design") === "console";
};
