/** Shows a prompt by its name without the ".md" extension. */
export const toPromptLabel = (name: string): string => name.replace(/\.md$/i, "");
