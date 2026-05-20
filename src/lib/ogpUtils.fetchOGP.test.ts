import { describe, expect, it, vi, beforeEach } from "vitest";

import { fetchOGPInBackground } from "./ogpUtils";

// Mock aws-amplify/auth
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn(),
}));

// Mock agentRuntime
vi.mock("@/src/lib/agent/agentRuntime", () => ({
  invokeRuntime: vi.fn(),
}));

import { fetchAuthSession } from "aws-amplify/auth";
import { invokeRuntime } from "@/src/lib/agent/agentRuntime";

const mockFetchAuthSession = vi.mocked(fetchAuthSession);
const mockInvokeRuntime = vi.mocked(invokeRuntime);

describe("fetchOGPInBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: auth returns a valid token
    mockFetchAuthSession.mockResolvedValue({
      tokens: {
        accessToken: { toString: () => "test-token" },
      },
    } as never);
  });

  it("returns immediately when runtimeArn is not set", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();

    await fetchOGPInBackground({
      bookmarkIds: ["b1", "b2"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "",
    });

    expect(onFetched).not.toHaveBeenCalled();
    expect(mockInvokeRuntime).not.toHaveBeenCalled();
  });

  it("returns immediately when bookmarkIds is empty", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();

    await fetchOGPInBackground({
      bookmarkIds: [],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(onFetched).not.toHaveBeenCalled();
    expect(mockInvokeRuntime).not.toHaveBeenCalled();
  });

  it("returns immediately when signal is already aborted", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();
    controller.abort();

    await fetchOGPInBackground({
      bookmarkIds: ["b1"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(onFetched).not.toHaveBeenCalled();
    expect(mockInvokeRuntime).not.toHaveBeenCalled();
  });

  it("returns immediately when auth fails", async () => {
    mockFetchAuthSession.mockRejectedValue(new Error("Auth failed"));
    const onFetched = vi.fn();
    const controller = new AbortController();

    await fetchOGPInBackground({
      bookmarkIds: ["b1"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(onFetched).not.toHaveBeenCalled();
    expect(mockInvokeRuntime).not.toHaveBeenCalled();
  });

  it("calls onFetched when OGP data is successfully parsed from agent response", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();

    mockInvokeRuntime.mockImplementation(async (params) => {
      params.onChunk('{"title": "Example", "description": "A page", "imageUrl": "https://img.example.com/og.png"}');
      params.onComplete();
    });

    await fetchOGPInBackground({
      bookmarkIds: ["b1"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(onFetched).toHaveBeenCalledWith("b1", {
      title: "Example",
      description: "A page",
      imageUrl: "https://img.example.com/og.png",
    });
  });

  it("handles JSON embedded in markdown code block", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();

    mockInvokeRuntime.mockImplementation(async (params) => {
      params.onChunk('Here is the OGP data:\n```json\n{"title": "Test", "description": "Desc", "imageUrl": "https://img.test.com/og.png"}\n```');
      params.onComplete();
    });

    await fetchOGPInBackground({
      bookmarkIds: ["b1"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(onFetched).toHaveBeenCalledWith("b1", {
      title: "Test",
      description: "Desc",
      imageUrl: "https://img.test.com/og.png",
    });
  });

  it("does not call onFetched when agent returns an error", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();

    mockInvokeRuntime.mockImplementation(async (params) => {
      params.onError("Connection failed");
    });

    await fetchOGPInBackground({
      bookmarkIds: ["b1"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(onFetched).not.toHaveBeenCalled();
  });

  it("does not call onFetched when response has no valid OGP data", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();

    mockInvokeRuntime.mockImplementation(async (params) => {
      params.onChunk("Sorry, I could not fetch OGP data for that URL.");
      params.onComplete();
    });

    await fetchOGPInBackground({
      bookmarkIds: ["b1"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(onFetched).not.toHaveBeenCalled();
  });

  it("skips bookmarks where getBookmarkUrl returns undefined", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();

    await fetchOGPInBackground({
      bookmarkIds: ["b1", "b2"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: (id) => (id === "b1" ? "https://example.com" : undefined),
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    // invokeRuntime should only be called for b1
    expect(mockInvokeRuntime).toHaveBeenCalledTimes(1);
  });

  it("limits concurrency to the specified value", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    mockInvokeRuntime.mockImplementation(async (params) => {
      concurrentCalls++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      params.onChunk('{"title": "T", "description": "D", "imageUrl": ""}');
      params.onComplete();
      concurrentCalls--;
    });

    await fetchOGPInBackground({
      bookmarkIds: ["b1", "b2", "b3", "b4", "b5"],
      concurrency: 2,
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(onFetched).toHaveBeenCalledTimes(5);
  });

  it("processes all bookmarks even when some fail", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();
    let callCount = 0;

    mockInvokeRuntime.mockImplementation(async (params) => {
      callCount++;
      if (callCount === 2) {
        params.onError("Failed");
      } else {
        params.onChunk('{"title": "OK", "description": "", "imageUrl": ""}');
        params.onComplete();
      }
    });

    await fetchOGPInBackground({
      bookmarkIds: ["b1", "b2", "b3"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    // b1 and b3 succeed, b2 fails
    expect(onFetched).toHaveBeenCalledTimes(2);
  });

  it("supports image_url field name in response", async () => {
    const onFetched = vi.fn();
    const controller = new AbortController();

    mockInvokeRuntime.mockImplementation(async (params) => {
      params.onChunk('{"title": "Test", "description": "Desc", "image_url": "https://img.test.com/og.png"}');
      params.onComplete();
    });

    await fetchOGPInBackground({
      bookmarkIds: ["b1"],
      onFetched,
      signal: controller.signal,
      getBookmarkUrl: () => "https://example.com",
      runtimeArn: "arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/test",
    });

    expect(onFetched).toHaveBeenCalledWith("b1", {
      title: "Test",
      description: "Desc",
      imageUrl: "https://img.test.com/og.png",
    });
  });
});
