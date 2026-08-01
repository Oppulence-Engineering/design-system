import { createRequire } from "node:module";

import type { IntegrationProviderPack } from "../../provider-pack";
import {
  optionalInputBoolean,
  optionalInputString,
  requiredInputString,
} from "../shared";
import {
  createProtocolPack,
  protocolConnection,
  protocolInvocationError,
  SshConnectionSchema,
  type ProtocolInput,
  type ProtocolOperation,
} from "./client";

const sshRequire = createRequire(import.meta.url);

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SshConnection {
  exec(command: string): Promise<ShellResult>;
}

export interface SftpConnection {
  list(path: string): Promise<unknown>;
  get(path: string): Promise<string>;
  put(content: string | Buffer, path: string): Promise<unknown>;
  delete(path: string): Promise<unknown>;
  rmdir(path: string, recursive?: boolean): Promise<unknown>;
  mkdir(path: string, recursive?: boolean): Promise<unknown>;
  rename(from: string, to: string): Promise<unknown>;
  exists(path: string): Promise<false | string>;
  stat(path: string): Promise<unknown>;
}

const MAX_OUTPUT_BYTES = 1_048_576;

/**
 * A remote path is interpolated into a shell command, so it is bounded to
 * characters that cannot start a new command, redirect, or expand. Callers
 * needing shell metacharacters use execute-command, where that is the point.
 */
function remotePath(input: ProtocolInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (
    value.length > 4_096 ||
    !/^[A-Za-z0-9._/~@+-]+$/u.test(value) ||
    value.includes("..")
  ) {
    throw protocolInvocationError();
  }
  return value;
}

/** Arbitrary shell is this action's purpose; only the size is bounded. */
function shellCommand(input: ProtocolInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (value.length > 65_536) throw protocolInvocationError();
  return value;
}

const SSH_OPERATIONS: Readonly<
  Record<string, ProtocolOperation<SshConnection>>
> = {
  "ssh:execute-command": {
    run: ({ client, input }) =>
      client.exec(shellCommand(input, "command", "cmd")),
  },
  "ssh:execute-script": {
    run: ({ client, input }) => {
      const script = shellCommand(input, "script", "content");
      const shell = optionalInputString(input, "shell") ?? "bash";
      if (!/^[a-z0-9/_-]{1,64}$/u.test(shell)) throw protocolInvocationError();
      // Feeding the script on stdin avoids quoting it into the command line.
      return client.exec(
        `${shell} -s <<'OPPULENCE_EOF'\n${script}\nOPPULENCE_EOF`,
      );
    },
  },
  "ssh:check-command-exists": {
    run: async ({ client, input }) => {
      const name = requiredInputString(input, "command", "name");
      if (!/^[A-Za-z0-9._-]{1,128}$/u.test(name)) {
        throw protocolInvocationError();
      }
      const result = await client.exec(`command -v ${name}`);
      return {
        command: name,
        exists: result.exitCode === 0,
        path: result.stdout.trim(),
      };
    },
  },
  "ssh:list-directory": {
    run: ({ client, input }) =>
      client.exec(`ls -la -- ${remotePath(input, "path", "directory")}`),
  },
  "ssh:check-file-directory-exists": {
    run: async ({ client, input }) => {
      const path = remotePath(input, "path");
      const result = await client.exec(`test -e ${path}`);
      return { path, exists: result.exitCode === 0 };
    },
  },
  "ssh:create-directory": {
    run: ({ client, input }) =>
      client.exec(`mkdir -p -- ${remotePath(input, "path", "directory")}`),
  },
  "ssh:delete-file-directory": {
    run: ({ client, input }) => {
      const recursive = optionalInputBoolean(input, "recursive") ?? false;
      return client.exec(
        `rm ${recursive ? "-rf" : "-f"} -- ${remotePath(input, "path")}`,
      );
    },
  },
  "ssh:move-rename": {
    run: ({ client, input }) =>
      client.exec(
        `mv -- ${remotePath(input, "source", "from", "path")} ${remotePath(input, "destination", "to", "newPath")}`,
      ),
  },
  "ssh:get-system-info": {
    run: ({ client }) =>
      client.exec("uname -a && uptime && df -h && free -m 2>/dev/null || true"),
  },
  "ssh:read-file-content": {
    run: ({ client, input }) =>
      client.exec(`cat -- ${remotePath(input, "path", "file")}`),
  },
  "ssh:write-file-content": {
    run: ({ client, input }) => {
      const content = requiredInputString(input, "content", "body");
      if (content.length > MAX_OUTPUT_BYTES) throw protocolInvocationError();
      const append = optionalInputBoolean(input, "append") ?? false;
      return client.exec(
        `cat ${append ? ">>" : ">"} ${remotePath(input, "path", "file")} <<'OPPULENCE_EOF'\n${content}\nOPPULENCE_EOF`,
      );
    },
  },
  "ssh:upload-file": {
    run: ({ client, input }) => {
      const content = requiredInputString(input, "content", "fileContent");
      if (content.length > MAX_OUTPUT_BYTES) throw protocolInvocationError();
      // Base64 keeps binary payloads intact across the shell.
      return client.exec(
        `base64 -d > ${remotePath(input, "path", "remotePath")} <<'OPPULENCE_EOF'\n${Buffer.from(content).toString("base64")}\nOPPULENCE_EOF`,
      );
    },
  },
  "ssh:download-file": {
    run: async ({ client, input }) => {
      const path = remotePath(input, "path", "remotePath");
      const result = await client.exec(`base64 -- ${path}`);
      return {
        path,
        content: Buffer.from(
          result.stdout.replace(/\s/gu, ""),
          "base64",
        ).toString("utf8"),
        exitCode: result.exitCode,
      };
    },
  },
};

const SFTP_OPERATIONS: Readonly<
  Record<string, ProtocolOperation<SftpConnection>>
> = {
  "sftp:list-directory": {
    run: ({ client, input }) =>
      client.list(remotePath(input, "path", "directory")),
  },
  "sftp:download-file": {
    run: async ({ client, input }) => {
      const path = remotePath(input, "path", "remotePath");
      return { path, content: await client.get(path) };
    },
  },
  "sftp:create-file": {
    run: ({ client, input }) =>
      client.put(
        requiredInputString(input, "content", "fileContent"),
        remotePath(input, "path", "remotePath"),
      ),
  },
  "sftp:upload-files": {
    run: async ({ client, input }) => {
      const files = input.files;
      if (!Array.isArray(files) || files.length === 0 || files.length > 50) {
        throw protocolInvocationError();
      }
      const uploaded: string[] = [];
      for (const entry of files) {
        if (!entry || typeof entry !== "object")
          throw protocolInvocationError();
        const file = entry as Record<string, unknown>;
        const path = remotePath(file, "path", "remotePath");
        await client.put(
          requiredInputString(file, "content", "fileContent"),
          path,
        );
        uploaded.push(path);
      }
      return { uploaded, count: uploaded.length };
    },
  },
  "sftp:create-directory": {
    run: ({ client, input }) =>
      client.mkdir(
        remotePath(input, "path", "directory"),
        optionalInputBoolean(input, "recursive") ?? true,
      ),
  },
  "sftp:delete-file-directory": {
    run: async ({ client, input }) => {
      const path = remotePath(input, "path");
      const stat = await client.exists(path);
      if (stat === "d") {
        await client.rmdir(
          path,
          optionalInputBoolean(input, "recursive") ?? false,
        );
        return { path, deleted: true, kind: "directory" };
      }
      await client.delete(path);
      return { path, deleted: true, kind: "file" };
    },
  },
};

interface Ssh2Client {
  on(event: string, listener: (...args: never[]) => void): Ssh2Client;
  connect(config: Record<string, unknown>): void;
  exec(
    command: string,
    callback: (error: Error | undefined, stream: Ssh2Stream) => void,
  ): void;
  end(): void;
}

interface Ssh2Stream {
  on(event: string, listener: (...args: never[]) => void): Ssh2Stream;
  stderr: { on(event: string, listener: (chunk: Buffer) => void): void };
}

export type SshConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: SshConnection; close: () => Promise<void> }>;

export type SftpConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: SftpConnection; close: () => Promise<void> }>;

function connectionConfig(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Record<string, unknown> {
  const settings = protocolConnection(
    SshConnectionSchema,
    credential,
    "password",
  );
  return {
    host: settings.host,
    port: settings.port ?? 22,
    username: settings.username,
    ...(settings.password ? { password: settings.password } : {}),
    ...(settings.privateKey ? { privateKey: settings.privateKey } : {}),
    ...(settings.passphrase ? { passphrase: settings.passphrase } : {}),
    readyTimeout: 15_000,
  };
}

async function connectSsh(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: SshConnection; close: () => Promise<void> }> {
  const { Client } = sshRequire("ssh2") as { Client: new () => Ssh2Client };
  const connection = new Client();
  await new Promise<void>((resolve, reject) => {
    connection
      .on("ready", (() => resolve()) as never)
      .on("error", ((error: Error) => reject(error)) as never)
      .connect(connectionConfig(credential));
  });

  return {
    client: {
      exec(command) {
        return new Promise<ShellResult>((resolve, reject) => {
          connection.exec(command, (error, stream) => {
            if (error) {
              reject(error);
              return;
            }
            let stdout = "";
            let stderr = "";
            let exitCode = 0;
            const append = (current: string, chunk: Buffer): string =>
              current.length >= MAX_OUTPUT_BYTES
                ? current
                : current + chunk.toString("utf8");
            stream
              .on("close", ((code: number) => {
                exitCode = code ?? 0;
                resolve({
                  stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
                  stderr: stderr.slice(0, MAX_OUTPUT_BYTES),
                  exitCode,
                });
              }) as never)
              .on("data", ((chunk: Buffer) => {
                stdout = append(stdout, chunk);
              }) as never);
            stream.stderr.on("data", (chunk) => {
              stderr = append(stderr, chunk);
            });
          });
        });
      },
    },
    close: async () => connection.end(),
  };
}

interface SftpSdkClient extends SftpConnection {
  connect(config: Record<string, unknown>): Promise<unknown>;
  end(): Promise<unknown>;
}

async function connectSftp(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: SftpConnection; close: () => Promise<void> }> {
  const SftpClient = sshRequire("ssh2-sftp-client") as new () => SftpSdkClient;
  const client = new SftpClient();
  await client.connect(connectionConfig(credential));
  return {
    client,
    close: async () => {
      await client.end();
    },
  };
}

export function createSshPack(
  options: { connect?: SshConnectionFactory } = {},
): IntegrationProviderPack {
  return createProtocolPack<SshConnection>({
    integrationId: "ssh",
    driver: "ssh2",
    operations: SSH_OPERATIONS,
    connect: options.connect ?? connectSsh,
  });
}

export function createSftpPack(
  options: { connect?: SftpConnectionFactory } = {},
): IntegrationProviderPack {
  return createProtocolPack<SftpConnection>({
    integrationId: "sftp",
    driver: "ssh2-sftp-client",
    operations: SFTP_OPERATIONS,
    connect: options.connect ?? connectSftp,
  });
}
