import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  DEFAULT_MONITOR_MAX_CACHE_AGE_MS,
  DEFAULT_MONITOR_MAX_POSTS,
  DEFAULT_MONITOR_SEARCH_WINDOW_DAYS,
} from "./defaults";
import type { MonitorRepository, PersistedMonitorCache, PersistedMonitorConfig } from "./types";

const MONITOR_CONFIG_VERSION = 1 as const;
const MONITOR_CACHE_VERSION = 1 as const;
const MONITOR_CONFIG_RELATIVE_PATH = ".octogent/state/monitor-config.json";
const MONITOR_CACHE_RELATIVE_PATH = ".octogent/state/monitor-cache.json";
const VALID_MONITOR_SEARCH_WINDOW_DAYS = new Set([1, 3, 7]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readJsonDocument = (path: string): unknown => {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const normalizeMonitorPost = (value: unknown): PersistedMonitorCache["posts"][number] | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const source = record.source;
  const id = typeof record.id === "string" ? record.id : null;
  const text = typeof record.text === "string" ? record.text : null;
  const author = typeof record.author === "string" ? record.author : null;
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : null;
  const likeCount =
    typeof record.likeCount === "number" && Number.isFinite(record.likeCount)
      ? Math.max(0, Math.floor(record.likeCount))
      : null;
  const permalink = typeof record.permalink === "string" ? record.permalink : null;
  const matchedQueryTerm =
    typeof record.matchedQueryTerm === "string" ? record.matchedQueryTerm : null;

  if (
    source !== "x" ||
    id === null ||
    text === null ||
    author === null ||
    createdAt === null ||
    likeCount === null ||
    permalink === null
  ) {
    return null;
  }

  return {
    source,
    id,
    text,
    author,
    createdAt,
    likeCount,
    permalink,
    matchedQueryTerm,
  };
};

const normalizeUsage = (value: unknown): PersistedMonitorCache["usage"] => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const status = record.status;
  if (status !== "ok" && status !== "unavailable" && status !== "error") {
    return null;
  }

  const source = record.source === "x-api" ? "x-api" : "none";
  const fetchedAt =
    typeof record.fetchedAt === "string" ? record.fetchedAt : new Date().toISOString();
  const message = typeof record.message === "string" ? record.message : null;

  const cap =
    typeof record.cap === "number" && Number.isFinite(record.cap) ? Math.max(0, record.cap) : null;
  const used =
    typeof record.used === "number" && Number.isFinite(record.used)
      ? Math.max(0, record.used)
      : null;
  const remaining =
    typeof record.remaining === "number" && Number.isFinite(record.remaining)
      ? Math.max(0, record.remaining)
      : null;
  const resetAt = typeof record.resetAt === "string" ? record.resetAt : null;

  return {
    status,
    source,
    fetchedAt,
    message,
    cap,
    used,
    remaining,
    resetAt,
  };
};

const normalizeCredentials = (
  value: unknown,
): PersistedMonitorConfig["providers"]["x"]["credentials"] => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const bearerToken = typeof record.bearerToken === "string" ? record.bearerToken.trim() : "";
  if (bearerToken.length === 0) {
    return null;
  }

  const normalizeOptional = (input: unknown) => {
    if (typeof input !== "string") {
      return null;
    }
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    bearerToken,
    apiKey: normalizeOptional(record.apiKey),
    apiSecret: normalizeOptional(record.apiSecret),
    accessToken: normalizeOptional(record.accessToken),
    accessTokenSecret: normalizeOptional(record.accessTokenSecret),
    updatedAt:
      typeof record.updatedAt === "string" && record.updatedAt.length > 0
        ? record.updatedAt
        : new Date().toISOString(),
  };
};

const defaultConfig = (): PersistedMonitorConfig => ({
  version: MONITOR_CONFIG_VERSION,
  providerId: "x",
  queryTerms: [],
  refreshPolicy: {
    maxCacheAgeMs: DEFAULT_MONITOR_MAX_CACHE_AGE_MS,
    maxPosts: DEFAULT_MONITOR_MAX_POSTS,
    searchWindowDays: DEFAULT_MONITOR_SEARCH_WINDOW_DAYS,
  },
  providers: {
    x: {
      credentials: null,
    },
  },
});

const defaultCache = (): PersistedMonitorCache => ({
  version: MONITOR_CACHE_VERSION,
  providerId: "x",
  queryTerms: defaultConfig().queryTerms,
  fetchedAt: null,
  lastError: null,
  posts: [],
  usage: null,
});

const normalizeConfig = (value: unknown): PersistedMonitorConfig => {
  const fallback = defaultConfig();
  const record = asRecord(value);
  if (!record || record.version !== MONITOR_CONFIG_VERSION) {
    return fallback;
  }

  const queryTerms = normalizeStringArray(record.queryTerms);
  const refreshPolicyRecord = asRecord(record.refreshPolicy);
  const maxCacheAgeMs =
    refreshPolicyRecord &&
    typeof refreshPolicyRecord.maxCacheAgeMs === "number" &&
    Number.isFinite(refreshPolicyRecord.maxCacheAgeMs) &&
    refreshPolicyRecord.maxCacheAgeMs > 0
      ? Math.floor(refreshPolicyRecord.maxCacheAgeMs)
      : fallback.refreshPolicy.maxCacheAgeMs;
  const maxPosts =
    refreshPolicyRecord &&
    typeof refreshPolicyRecord.maxPosts === "number" &&
    Number.isFinite(refreshPolicyRecord.maxPosts) &&
    refreshPolicyRecord.maxPosts > 0
      ? Math.floor(refreshPolicyRecord.maxPosts)
      : fallback.refreshPolicy.maxPosts;
  const searchWindowDaysRaw =
    refreshPolicyRecord &&
    typeof refreshPolicyRecord.searchWindowDays === "number" &&
    Number.isFinite(refreshPolicyRecord.searchWindowDays)
      ? Math.floor(refreshPolicyRecord.searchWindowDays)
      : null;
  const searchWindowDays =
    searchWindowDaysRaw !== null && VALID_MONITOR_SEARCH_WINDOW_DAYS.has(searchWindowDaysRaw)
      ? (searchWindowDaysRaw as 1 | 3 | 7)
      : fallback.refreshPolicy.searchWindowDays;

  const providersRecord = asRecord(record.providers);
  const xProviderRecord = providersRecord ? asRecord(providersRecord.x) : null;

  return {
    version: MONITOR_CONFIG_VERSION,
    providerId: record.providerId === "x" ? "x" : fallback.providerId,
    queryTerms,
    refreshPolicy: {
      maxCacheAgeMs,
      maxPosts,
      searchWindowDays,
    },
    providers: {
      x: {
        credentials: normalizeCredentials(xProviderRecord?.credentials),
      },
    },
  };
};

const normalizeCache = (value: unknown): PersistedMonitorCache => {
  const fallback = defaultCache();
  const record = asRecord(value);
  if (!record || record.version !== MONITOR_CACHE_VERSION) {
    return fallback;
  }

  const posts = Array.isArray(record.posts)
    ? record.posts
        .map((post) => normalizeMonitorPost(post))
        .filter((post): post is NonNullable<typeof post> => post !== null)
    : [];

  const queryTerms = normalizeStringArray(record.queryTerms);

  return {
    version: MONITOR_CACHE_VERSION,
    providerId: record.providerId === "x" ? "x" : fallback.providerId,
    queryTerms,
    fetchedAt: typeof record.fetchedAt === "string" ? record.fetchedAt : null,
    lastError: typeof record.lastError === "string" ? record.lastError : null,
    posts,
    usage: normalizeUsage(record.usage),
  };
};

const writeJsonDocument = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const createFileMonitorRepository = (projectStateDir: string): MonitorRepository => {
  const configPath = join(projectStateDir, "state", "monitor-config.json");
  const cachePath = join(projectStateDir, "state", "monitor-cache.json");

  return {
    readConfig() {
      if (!existsSync(configPath)) {
        return defaultConfig();
      }

      try {
        return normalizeConfig(readJsonDocument(configPath));
      } catch {
        return defaultConfig();
      }
    },

    writeConfig(config) {
      writeJsonDocument(configPath, config);
    },

    readCache() {
      if (!existsSync(cachePath)) {
        return defaultCache();
      }

      try {
        return normalizeCache(readJsonDocument(cachePath));
      } catch {
        return defaultCache();
      }
    },

    writeCache(cache) {
      writeJsonDocument(cachePath, cache);
    },
  };
};
