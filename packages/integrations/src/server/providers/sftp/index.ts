import { createRequire } from "node:module";
import { requireOptionalSdk } from "../shared/optional-sdk";

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
} from "../shared/ssh-connection";
import type {
  SftpConnection,
  SftpConnectionFactory,
  ShellResult,
  SshConnection,
  SshConnectionFactory,
} from "../shared/ssh-connection";

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

interface SftpSdkClient extends SftpConnection {
  connect(config: Record<string, unknown>): Promise<unknown>;
  end(): Promise<unknown>;
}

async function connectSftp(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: SftpConnection; close: () => Promise<void> }> {
  const SftpClient = requireOptionalSdk("ssh2-sftp-client") as new () => SftpSdkClient;
  const client = new SftpClient();
  await client.connect(connectionConfig(credential));
  return {
    client,
    close: async () => {
      await client.end();
    },
  };
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
