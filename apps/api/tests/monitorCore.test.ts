import { describe, expect, it } from "vitest";

import { isMonitorCacheStale, rankAndLimitPostsByLikes } from "../src/monitor/service";
import type { MonitorPost } from "../src/monitor/types";
import { buildXRecentSearchQuery } from "../src/monitor/xProvider";

describe("monitor core logic", () => {
  it("builds X recent-search query with OR terms, lang filter, and no-retweet filter", () => {
    const query = buildXRecentSearchQuery(["AI Engineering", "Codex"]);

    expect(query).toContain('"AI Engineering"');
    expect(query).toContain("Codex");
    expect(query).toContain(" OR ");
    expect(query).toContain("lang:en");
    expect(query).toContain("-is:retweet");
  });

  it("throws when no valid query terms are provided", () => {
    expect(() => buildXRecentSearchQuery(["", "   "])).toThrow(
      "At least one X query term is required.",
    );
  });

  it("flags cache as stale when older than refresh policy window", () => {
    const now = new Date("2026-02-28T12:00:00.000Z");
    const configuredQueryTerms = ["Codex"];

    expect(
      isMonitorCacheStale({
        now,
        maxCacheAgeMs: 24 * 60 * 60 * 1000,
        lastFetchedAt: null,
        cachedQueryTerms: configuredQueryTerms,
        currentQueryTerms: configuredQueryTerms,
      }),
    ).toBe(true);

    expect(
      isMonitorCacheStale({
        now,
        maxCacheAgeMs: 24 * 60 * 60 * 1000,
        lastFetchedAt: "2026-02-27T13:00:00.000Z",
        cachedQueryTerms: configuredQueryTerms,
        currentQueryTerms: configuredQueryTerms,
      }),
    ).toBe(false);

    expect(
      isMonitorCacheStale({
        now,
        maxCacheAgeMs: 24 * 60 * 60 * 1000,
        lastFetchedAt: "2026-02-27T11:59:59.000Z",
        cachedQueryTerms: configuredQueryTerms,
        currentQueryTerms: configuredQueryTerms,
      }),
    ).toBe(true);

    expect(
      isMonitorCacheStale({
        now,
        maxCacheAgeMs: 24 * 60 * 60 * 1000,
        lastFetchedAt: "2026-02-28T11:00:00.000Z",
        cachedQueryTerms: ["Codex"],
        currentQueryTerms: ["Agent Engineering"],
      }),
    ).toBe(true);
  });

  it("dedupes, ranks by like count desc, and limits to top 30", () => {
    const basePosts: MonitorPost[] = Array.from({ length: 32 }).map((_, index) => ({
      source: "x",
      id: `id-${index + 1}`,
      text: `Post ${index + 1}`,
      author: `author-${index + 1}`,
      createdAt: `2026-02-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
      likeCount: index,
      permalink: `https://x.com/user/status/${index + 1}`,
      matchedQueryTerm: "Codex",
    }));
    const firstPost = basePosts[0] as MonitorPost;
    const lastPost = basePosts[31] as MonitorPost;

    const withDuplicate: MonitorPost[] = [
      ...basePosts,
      {
        ...firstPost,
        text: "duplicate with lower likes should be dropped",
        likeCount: 0,
      },
      {
        ...lastPost,
        likeCount: 999,
      },
    ];

    const ranked = rankAndLimitPostsByLikes(withDuplicate, 30);

    expect(ranked).toHaveLength(30);
    expect(ranked[0]?.id).toBe("id-32");
    expect(ranked[0]?.likeCount).toBe(999);
    expect(new Set(ranked.map((post) => post.id)).size).toBe(ranked.length);
    expect(ranked.at(-1)?.likeCount).toBeGreaterThanOrEqual(2);
  });
});
