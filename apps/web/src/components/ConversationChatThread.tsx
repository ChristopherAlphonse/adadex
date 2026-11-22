import {
  type DiffLine,
  type ParsedRecord,
  type TranscriptBlock,
  type TranscriptMessage,
  asString,
  extractDiff,
  isSubagentToolCall,
} from "@adadex/core";
import { useMemo } from "react";

import { MarkdownContent } from "./ui/MarkdownContent";

type ToolCallBlock = Extract<TranscriptBlock, { kind: "tool-call" }>;

type ToolResultBlock = Extract<TranscriptBlock, { kind: "tool-result" }>;

const SUMMARY_FIELDS = ["command", "file_path", "pattern", "url", "description", "path"];

const summarizeInput = (input: ParsedRecord): string => {
  for (const field of SUMMARY_FIELDS) {
    const value = asString(input[field]);

    if (value) {
      return value.length > 100 ? `${value.slice(0, 97)}...` : value;
    }
  }

  return "";
};

const keyedLines = (lines: DiffLine[]) => {
  const seen = new Map<string, number>();

  return lines.map((line) => {
    const base = `${line.kind}:${line.text}`;
    const count = seen.get(base) ?? 0;

    seen.set(base, count + 1);

    return { line, key: `${base}#${count}` };
  });
};

const DiffView = ({ lines }: { lines: DiffLine[] }) => (
  <pre className="chat-diff">
    {keyedLines(lines).map(({ line, key }) => (
      <span className="chat-diff-line" data-kind={line.kind} key={key}>
        {line.text}
        {"\n"}
      </span>
    ))}
  </pre>
);

const ToolCallCard = ({
  block,
  result,
}: {
  block: ToolCallBlock;
  result?: ToolResultBlock | undefined;
}) => {
  const diff = extractDiff(block.name, block.input);
  const summary = summarizeInput(block.input);

  return (
    <details className="chat-tool" data-error={result?.isError ? "true" : undefined}>
      <summary>
        <span className="chat-tool-name">{block.name}</span>
        {isSubagentToolCall(block.name) ? <span className="chat-chip">sub-agent</span> : null}
        {summary ? <span className="chat-tool-summary">{summary}</span> : null}
      </summary>
      {diff ? <DiffView lines={diff.lines} /> : null}
      {diff?.truncated ? <p className="chat-tool-note">Diff truncated.</p> : null}
      {result?.text ? <pre className="chat-tool-result">{result.text}</pre> : null}
    </details>
  );
};

const MessageBlocks = ({
  message,
  results,
}: {
  message: TranscriptMessage;
  results: Map<string, ToolResultBlock>;
}) => (
  <>
    {message.blocks.map((block, index) => {
      const key = `${message.id}-${index}`;

      if (block.kind === "text") {
        return (
          <div className="chat-bubble" key={key}>
            <MarkdownContent content={block.text} className="chat-bubble-content" />
          </div>
        );
      }

      if (block.kind === "tool-call") {
        return <ToolCallCard block={block} key={key} result={results.get(block.toolUseId)} />;
      }

      if (block.kind === "image-ref") {
        return (
          <p className="chat-tool-note" key={key}>
            [image]
          </p>
        );
      }

      return null;
    })}
  </>
);

export const ConversationChatThread = ({ messages }: { messages: TranscriptMessage[] }) => {
  const results = useMemo(() => {
    const map = new Map<string, ToolResultBlock>();

    for (const message of messages) {
      for (const block of message.blocks) {
        if (block.kind === "tool-result") {
          map.set(block.toolUseId, block);
        }
      }
    }

    return map;
  }, [messages]);

  return (
    <ol className="chat-thread chat-thread--rich">
      {messages
        .filter((message) => message.role !== "tool")
        .map((message) => (
          <li className="chat-turn chat-turn--rich" data-role={message.role} key={message.id}>
            <MessageBlocks message={message} results={results} />
          </li>
        ))}
    </ol>
  );
};
