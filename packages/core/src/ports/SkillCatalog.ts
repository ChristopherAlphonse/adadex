export interface SkillInfo {
  readonly name: string;
  /** Path to the skill's SKILL.md. */
  readonly path: string;
  /** Which configured folder it came from, for example `calphonse-skills` or `my-team`. */
  readonly source: string;
}

/** Lists the skills found in the folders this machine is configured to look in. The app ships none. */
export interface SkillCatalog {
  list(): Promise<readonly SkillInfo[]>;
}
