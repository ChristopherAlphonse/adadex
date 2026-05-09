export type MonitorUsageSnapshot = {
  status: "ok" | "unavailable" | "error";
  source: "x-api" | "none";
  fetchedAt: string;
  message?: string | null;
  cap?: number | null;
  used?: number | null;
  remaining?: number | null;
  resetAt?: string | null;
};

export type MonitorPost = {
  source: "x";
  id: string;
  text: string;
  author: string;
  createdAt: string;
  likeCount: number;
  permalink: string;
  matchedQueryTerm: string | null;
};

export type MonitorCredentialSummary = {
  isConfigured: boolean;
  bearerTokenHint: string | null;
  apiKeyHint: string | null;
  hasApiSecret: boolean;
  hasAccessToken: boolean;
  hasAccessTokenSecret: boolean;
  updatedAt: string | null;
};

export type MonitorConfigSnapshot = {
  providerId: "x";
  queryTerms: string[];
  refreshPolicy: {
    maxCacheAgeMs: number;
    maxPosts: number;
    searchWindowDays: 1 | 3 | 7;
  };
  providers: {
    x: {
      credentials: MonitorCredentialSummary;
    };
  };
};

export type MonitorFeedSnapshot = {
  providerId: "x";
  queryTerms: string[];
  refreshPolicy: {
    maxCacheAgeMs: number;
    maxPosts: number;
    searchWindowDays: 1 | 3 | 7;
  };
  lastFetchedAt: string | null;
  staleAfter: string | null;
  isStale: boolean;
  lastError: string | null;
  posts: MonitorPost[];
  usage: MonitorUsageSnapshot | null;
};
