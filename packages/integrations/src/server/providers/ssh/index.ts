import { createRequire } from "node:module";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  optionalInputBoolean,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";
import {
  createProtocolPack,
  protocolConnection,
  protocolInvocationError,
  SshConnectionSchema,
  type ProtocolInput,
  type ProtocolOperation,
} from "../shared/clients/protocol";

import {
  connectionConfig,
  MAX_OUTPUT_BYTES,
  remotePath,
  shellCommand,
  sshRequire,
} from "../shared/ssh-connection";
import type {
  SftpConnection,
  SftpConnectionFactory,
  ShellResult,
  SshConnection,
  SshConnectionFactory,
} from "../shared/ssh-connection";

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
