/**
 * Files an agent's work must never touch: CI, hooks, secrets and owner files. A gate run fails when a
 * change includes one, so a build cannot quietly change how it is checked.
 */
export const PROTECTED_FLOOR: readonly string[] = [
  ".github/**",
  ".gitlab/**",
  ".gitlab-ci.yml",
  "Jenkinsfile",
  "CODEOWNERS",
  "**/CODEOWNERS",
  ".env",
  "**/.env",
  "**/.env.*",
  ".planning/factory/**",
  ".adadex/factory/**",
  ".husky/**",
  ".githooks/**",
  ".pre-commit-config.yaml",
  ".gitmodules",
  "**/.gitmodules",
  ".gitattributes",
  "**/.gitattributes",
  ".circleci/**",
  ".buildkite/**",
  "azure-pipelines.yml",
  ".npmrc",
  "**/.npmrc",
];
