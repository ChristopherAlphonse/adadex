import { describe, expect, it, vi } from "vitest";

import { createXMonitorProvider } from "../src/monitor/xProvider";

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });

describe("x monitor provider", () => {
  it("runs separate recent searches per query term", async () => {
    const recentSearchQueries: string[] = [];

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      );
      if (url.pathname !== "/2/tweets/search/recent") {
        throw new Error(`Unexpected URL ${url.toString()}`);
      }

      const query = url.searchParams.get("query") ?? "";
      recentSearchQueries.push(query);

      if (query.includes('"Alpha"')) {
        return jsonResponse({
          data: [
            {
              id: "1",
              text: "Alpha result",
              created_at: "2026-02-28T10:00:00.000Z",
              author_id: "user-alpha",
              public_metrics: {
                like_count: 10,
              },
            },
          ],
          includes: {
            users: [
              {
                id: "user-alpha",
                username: "alpha",
                name: "Alpha",
              },
            ],
          },
          meta: {},
        });
      }

      if (query.includes('"Beta"')) {
        return jsonResponse({
          data: [
            {
              id: "2",
              text: "Beta result",
              created_at: "2026-02-28T10:30:00.000Z",
              author_id: "user-beta",
              public_metrics: {
                like_count: 20,
              },
            },
          ],
          includes: {
            users: [
              {
                id: "user-beta",
                username: "beta",
                name: "Beta",
              },
            ],
          },
          meta: {},
        });
      }

      throw new Error(`Unexpected query "${query}"`);
    });

    const provider = createXMonitorProvider({
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const posts = await provider.fetchRecentPosts({
      credentials: {
        bearerToken: "x-test-token",
        apiKey: null,
        apiSecret: null,
        accessToken: null,
        accessTokenSecret: null,
        updatedAt: "2026-02-28T12:00:00.000Z",
      },
      queryTerms: ["Alpha", "Beta"],
      postLimit: 4,
      searchWindowDays: 7,
      now: new Date("2026-02-28T12:00:00.000Z"),
    });

    expect(posts).toHaveLength(2);
    expect(new Set(posts.map((post) => post.matchedQueryTerm))).toEqual(new Set(["Alpha", "Beta"]));
    expect(recentSearchQueries).toHaveLength(2);
    expect(recentSearchQueries.every((query) => !query.includes(" OR "))).toBe(true);
    expect(recentSearchQueries).toContain('("Alpha") lang:en -is:retweet');
    expect(recentSearchQueries).toContain('("Beta") lang:en -is:retweet');
  });
});
