import { createRequire } from "node:module";

import {
  optionalInputBoolean,
  optionalInputString,
  requiredInputString,
} from "./sdk";
import {
  createProtocolPack,
  protocolConnection,
  protocolInvocationError,
  SshConnectionSchema,
  type ProtocolInput,
  type ProtocolOperation,
} from "./clients/protocol";

export const sshRequire = createRequire(import.meta.url);

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

export const MAX_OUTPUT_BYTES = 1_048_576;

/**
 * A remote path is interpolated into a shell command, so it is bounded to
 * characters that cannot start a new command, redirect, or expand. Callers
 * needing shell metacharacters use execute-command, where that is the point.
 */
export function remotePath(input: ProtocolInput, ...names: string[]): string {
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
export function shellCommand(input: ProtocolInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (value.length > 65_536) throw protocolInvocationError();
  return value;
}

export type SshConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: SshConnection; close: () => Promise<void> }>;

export type SftpConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: SftpConnection; close: () => Promise<void> }>;

export function connectionConfig(credential: {
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
