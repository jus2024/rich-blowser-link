import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AgentChatSection from "./AgentChatSection";

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock useAgentChat
const mockSendMessage = vi.fn();
vi.mock("@/src/hooks/useAgentChat", () => ({
  useAgentChat: vi.fn(() => ({
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: mockSendMessage,
  })),
}));

// Mock fetchAuthSession
vi.mock("aws-amplify/auth", () => ({
  fetchAuthSession: vi.fn(() =>
    Promise.resolve({ tokens: { accessToken: "mock-token" } })
  ),
}));

// Mock isAmplifyConfigured
vi.mock("@/src/lib/amplify/AmplifyProvider", () => ({
  isAmplifyConfigured: vi.fn(() => true),
}));

import { useAgentChat } from "@/src/hooks/useAgentChat";
import { fetchAuthSession } from "aws-amplify/auth";
import { isAmplifyConfigured } from "@/src/lib/amplify/AmplifyProvider";

describe("AgentChatSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAmplifyConfigured).mockReturnValue(true);
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: { accessToken: { toString: () => "mock-token" } },
    } as never);
  });

  it("renders the section heading for Bookmark search", () => {
    render(<AgentChatSection runtimeArn="arn:aws:bedrock-agentcore:us-west-2:123:runtime/test" />);
    expect(screen.getByRole("heading", { name: /AI Bookmark 検索/ })).toBeInTheDocument();
  });

  it("shows runtime not configured message when runtimeArn is undefined", () => {
    render(<AgentChatSection runtimeArn={undefined} />);
    expect(
      screen.getByText(/AgentCore Runtime が設定されていません/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/NEXT_PUBLIC_AGENTCORE_RUNTIME_ARN/)
    ).toBeInTheDocument();
  });

  it("shows runtime not configured message when runtimeArn is empty string", () => {
    render(<AgentChatSection runtimeArn="" />);
    expect(
      screen.getByText(/AgentCore Runtime が設定されていません/)
    ).toBeInTheDocument();
  });

  it("disables input when runtime is not configured", () => {
    render(<AgentChatSection runtimeArn={undefined} />);
    const input = screen.getByPlaceholderText("メッセージを入力...");
    expect(input).toBeDisabled();
  });

  it("shows unauthenticated message when user is not logged in", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: undefined,
    } as never);

    render(<AgentChatSection runtimeArn="arn:aws:bedrock-agentcore:us-west-2:123:runtime/test" />);

    // Wait for auth check to complete
    const message = await screen.findByText(/チャット機能を利用するにはログインが必要です/);
    expect(message).toBeInTheDocument();
  });

  it("disables input when user is not authenticated", async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: undefined,
    } as never);

    render(<AgentChatSection runtimeArn="arn:aws:bedrock-agentcore:us-west-2:123:runtime/test" />);

    // Wait for auth check to complete
    await screen.findByText(/チャット機能を利用するにはログインが必要です/);
    const input = screen.getByPlaceholderText("メッセージを入力...");
    expect(input).toBeDisabled();
  });

  it("shows error message when there is a communication error", () => {
    vi.mocked(useAgentChat).mockReturnValue({
      messages: [
        { id: "1", role: "user", content: "テスト質問", timestamp: Date.now() },
      ],
      isLoading: false,
      error: "HTTP 500: Internal Server Error",
      sendMessage: mockSendMessage,
    });

    render(<AgentChatSection runtimeArn="arn:aws:bedrock-agentcore:us-west-2:123:runtime/test" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/HTTP 500: Internal Server Error/)).toBeInTheDocument();
  });

  it("maintains conversation history when error occurs", () => {
    vi.mocked(useAgentChat).mockReturnValue({
      messages: [
        { id: "1", role: "user", content: "最初の質問", timestamp: Date.now() },
        { id: "2", role: "assistant", content: "回答です", timestamp: Date.now() },
        { id: "3", role: "user", content: "次の質問", timestamp: Date.now() },
      ],
      isLoading: false,
      error: "Network error",
      sendMessage: mockSendMessage,
    });

    render(<AgentChatSection runtimeArn="arn:aws:bedrock-agentcore:us-west-2:123:runtime/test" />);

    // Error is shown
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // Messages are still displayed (conversation history maintained)
    expect(screen.getByText("最初の質問")).toBeInTheDocument();
    expect(screen.getByText("回答です")).toBeInTheDocument();
    expect(screen.getByText("次の質問")).toBeInTheDocument();
  });

  it("does not show runtime message when ARN is configured", () => {
    render(<AgentChatSection runtimeArn="arn:aws:bedrock-agentcore:us-west-2:123:runtime/test" />);
    expect(
      screen.queryByText(/AgentCore Runtime が設定されていません/)
    ).not.toBeInTheDocument();
  });

  it("skips auth check when Amplify is not configured", async () => {
    vi.mocked(isAmplifyConfigured).mockReturnValue(false);
    vi.mocked(fetchAuthSession).mockRejectedValue(new Error("Not configured"));

    render(<AgentChatSection runtimeArn="arn:aws:bedrock-agentcore:us-west-2:123:runtime/test" />);

    // Should not show unauthenticated message
    // Wait a tick for the effect to run
    await vi.waitFor(() => {
      expect(
        screen.queryByText(/チャット機能を利用するにはログインが必要です/)
      ).not.toBeInTheDocument();
    });
  });
});
