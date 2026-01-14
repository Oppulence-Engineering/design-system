export type ChatRole = "assistant" | "user" | "system" | "tool";

export type ChatStatus = "idle" | "submitted" | "streaming" | "error";

export type FileUIPart = {
  type: "file";
  url?: string;
  mediaType?: string;
  filename?: string;
  data?: string;
};

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export type ToolUIPart = {
  type: string;
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string | null;
};

export type GeneratedImage = {
  base64: string;
  mediaType: string;
  uint8Array?: Uint8Array;
};
