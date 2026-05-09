export const parseTentacleCommitMessage = (
  payload: unknown,
): { message: string | null; error: string | null } => {
  if (payload === null || payload === undefined || typeof payload !== "object") {
    return {
      message: null,
      error: "Expected a JSON object body.",
    };
  }

  const rawMessage = (payload as Record<string, unknown>).message;
  if (typeof rawMessage !== "string") {
    return {
      message: null,
      error: "Commit message must be a string.",
    };
  }

  const trimmed = rawMessage.trim();
  if (trimmed.length === 0) {
    return {
      message: null,
      error: "Commit message cannot be empty.",
    };
  }

  return {
    message: trimmed,
    error: null,
  };
};

export const parseTentacleSyncBaseRef = (
  payload: unknown,
): { baseRef: string | null; error: string | null } => {
  if (payload === null || payload === undefined) {
    return {
      baseRef: null,
      error: null,
    };
  }

  if (typeof payload !== "object") {
    return {
      baseRef: null,
      error: "Expected a JSON object body.",
    };
  }

  const rawBaseRef = (payload as Record<string, unknown>).baseRef;
  if (rawBaseRef === undefined) {
    return {
      baseRef: null,
      error: null,
    };
  }

  if (typeof rawBaseRef !== "string") {
    return {
      baseRef: null,
      error: "baseRef must be a string.",
    };
  }

  const trimmed = rawBaseRef.trim();
  if (trimmed.length === 0) {
    return {
      baseRef: null,
      error: "baseRef cannot be empty.",
    };
  }

  return {
    baseRef: trimmed,
    error: null,
  };
};

export const parseTentaclePullRequestCreateInput = (
  payload: unknown,
): {
  title: string | null;
  body: string;
  baseRef: string | null;
  error: string | null;
} => {
  if (payload === null || payload === undefined || typeof payload !== "object") {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Expected a JSON object body.",
    };
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.title !== "string" || record.title.trim().length === 0) {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request title cannot be empty.",
    };
  }

  if (record.body !== undefined && typeof record.body !== "string") {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request body must be a string.",
    };
  }

  if (record.baseRef !== undefined && typeof record.baseRef !== "string") {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request baseRef must be a string.",
    };
  }

  const normalizedBaseRef = typeof record.baseRef === "string" ? record.baseRef.trim() : "";
  if (record.baseRef !== undefined && normalizedBaseRef.length === 0) {
    return {
      title: null,
      body: "",
      baseRef: null,
      error: "Pull request baseRef cannot be empty.",
    };
  }

  return {
    title: record.title.trim(),
    body: typeof record.body === "string" ? record.body : "",
    baseRef: normalizedBaseRef.length > 0 ? normalizedBaseRef : null,
    error: null,
  };
};
