import type { IntegrationProviderPack } from "../../provider-pack";
import { optionalInputString, requiredInputString } from "../shared";
import {
  createProtocolPack,
  JupyterConnectionSchema,
  protocolConnection,
  protocolInvocationError,
  type ProtocolInput,
  type ProtocolOperation,
} from "./client";

/**
 * Jupyter speaks HTTP, but every deployment is self-hosted, so the base URL is
 * per-connection rather than a fixed vendor host. The typed REST lane resolves
 * relative paths against one configured provider host and cannot express that,
 * which is why Jupyter is a special provider.
 */
export interface JupyterConnection {
  request(input: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    body?: unknown;
  }): Promise<unknown>;
}

const MAX_RESPONSE_BYTES = 5 * 1_048_576;

/** A contents path is a URL segment sequence, not an arbitrary string. */
function contentsPath(input: ProtocolInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (value.length > 1_024 || value.includes("..") || /^[/\\]/u.test(value)) {
    throw protocolInvocationError();
  }
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function optionalContentsPath(
  input: ProtocolInput,
  ...names: string[]
): string {
  return optionalInputString(input, ...names) === undefined
    ? ""
    : contentsPath(input, ...names);
}

function identifier(input: ProtocolInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(value)) throw protocolInvocationError();
  return value;
}

const JUPYTER_OPERATIONS: Readonly<
  Record<string, ProtocolOperation<JupyterConnection>>
> = {
  "jupyter:list-contents": {
    run: ({ client, input }) =>
      client.request({
        method: "GET",
        path: `/api/contents/${optionalContentsPath(input, "path", "directory")}`,
      }),
  },
  "jupyter:get-content": {
    run: ({ client, input }) =>
      client.request({
        method: "GET",
        path: `/api/contents/${contentsPath(input, "path")}`,
      }),
  },
  "jupyter:create-file": {
    run: ({ client, input }) => {
      const type = optionalInputString(input, "type") ?? "file";
      if (!["file", "directory", "notebook"].includes(type)) {
        throw protocolInvocationError();
      }
      return client.request({
        method: "POST",
        path: `/api/contents/${optionalContentsPath(input, "path", "directory")}`,
        body: { type, ext: optionalInputString(input, "ext") ?? ".txt" },
      });
    },
  },
  "jupyter:upload-file": {
    run: ({ client, input }) =>
      client.request({
        method: "PUT",
        path: `/api/contents/${contentsPath(input, "path")}`,
        body: {
          type: optionalInputString(input, "type") ?? "file",
          format: optionalInputString(input, "format") ?? "text",
          content: requiredInputString(input, "content", "fileContent"),
        },
      }),
  },
  "jupyter:rename-content": {
    run: ({ client, input }) =>
      client.request({
        method: "PATCH",
        path: `/api/contents/${contentsPath(input, "path")}`,
        body: {
          path: decodeURIComponent(
            contentsPath(input, "newPath", "destination"),
          ),
        },
      }),
  },
  "jupyter:copy-content": {
    run: ({ client, input }) =>
      client.request({
        method: "POST",
        path: `/api/contents/${optionalContentsPath(input, "destination", "directory")}`,
        body: {
          copy_from: decodeURIComponent(contentsPath(input, "path", "source")),
        },
      }),
  },
  "jupyter:delete-content": {
    run: async ({ client, input }) => {
      const path = contentsPath(input, "path");
      await client.request({ method: "DELETE", path: `/api/contents/${path}` });
      return { path, deleted: true };
    },
  },
  "jupyter:list-kernels": {
    run: ({ client }) =>
      client.request({ method: "GET", path: "/api/kernels" }),
  },
  "jupyter:start-kernel": {
    run: ({ client, input }) =>
      client.request({
        method: "POST",
        path: "/api/kernels",
        body: {
          name: optionalInputString(input, "kernelName", "name") ?? "python3",
        },
      }),
  },
  "jupyter:stop-kernel": {
    run: async ({ client, input }) => {
      const kernelId = identifier(input, "kernelId", "id");
      await client.request({
        method: "DELETE",
        path: `/api/kernels/${kernelId}`,
      });
      return { kernelId, stopped: true };
    },
  },
  "jupyter:restart-kernel": {
    run: ({ client, input }) =>
      client.request({
        method: "POST",
        path: `/api/kernels/${identifier(input, "kernelId", "id")}/restart`,
      }),
  },
  "jupyter:interrupt-kernel": {
    run: async ({ client, input }) => {
      const kernelId = identifier(input, "kernelId", "id");
      await client.request({
        method: "POST",
        path: `/api/kernels/${kernelId}/interrupt`,
      });
      return { kernelId, interrupted: true };
    },
  },
  "jupyter:list-kernel-specs": {
    run: ({ client }) =>
      client.request({ method: "GET", path: "/api/kernelspecs" }),
  },
  "jupyter:list-sessions": {
    run: ({ client }) =>
      client.request({ method: "GET", path: "/api/sessions" }),
  },
  "jupyter:create-session": {
    run: ({ client, input }) =>
      client.request({
        method: "POST",
        path: "/api/sessions",
        body: {
          path: decodeURIComponent(contentsPath(input, "path", "notebookPath")),
          type: optionalInputString(input, "type") ?? "notebook",
          name: optionalInputString(input, "name") ?? "",
          kernel: {
            name: optionalInputString(input, "kernelName") ?? "python3",
          },
        },
      }),
  },
  "jupyter:delete-session": {
    run: async ({ client, input }) => {
      const sessionId = identifier(input, "sessionId", "id");
      await client.request({
        method: "DELETE",
        path: `/api/sessions/${sessionId}`,
      });
      return { sessionId, deleted: true };
    },
  },
};

export type JupyterConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: JupyterConnection; close: () => Promise<void> }>;

async function connectJupyter(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: JupyterConnection; close: () => Promise<void> }> {
  const settings = protocolConnection(
    JupyterConnectionSchema,
    credential,
    "token",
  );
  const base = new URL(settings.baseUrl);

  return {
    client: {
      async request({ method, path, body }) {
        const url = new URL(
          `${base.pathname.replace(/\/$/u, "")}${path}`,
          base.origin,
        );
        const response = await fetch(url, {
          method,
          headers: {
            authorization: `token ${settings.token}`,
            accept: "application/json",
            ...(body === undefined
              ? {}
              : { "content-type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(30_000),
        });
        const length = Number(response.headers.get("content-length"));
        if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) {
          throw protocolInvocationError();
        }
        if (response.status === 204) return { ok: true };
        const text = await response.text();
        if (text.length > MAX_RESPONSE_BYTES) throw protocolInvocationError();
        if (!text) return { ok: response.ok, status: response.status };
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return { status: response.status, body: text };
        }
      },
    },
    // A Jupyter connection is stateless per request; nothing to release.
    close: async () => undefined,
  };
}

export function createJupyterPack(
  options: { connect?: JupyterConnectionFactory } = {},
): IntegrationProviderPack {
  return createProtocolPack<JupyterConnection>({
    integrationId: "jupyter",
    driver: "the Jupyter server API",
    operations: JUPYTER_OPERATIONS,
    connect: options.connect ?? connectJupyter,
  });
}
