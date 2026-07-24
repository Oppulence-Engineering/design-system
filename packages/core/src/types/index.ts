export * from "./idempotencyKeys.js";
export * from "./queues.js";
export * from "./tools.js";
export * from "./utils.js";

type ResolveEnvironmentVariablesOptions = {
  variables: Record<string, string> | Array<{ name: string; value: string }>;
  override?: boolean;
};

export type ResolveEnvironmentVariablesResult =
  | ResolveEnvironmentVariablesOptions
  | Promise<undefined | undefined | ResolveEnvironmentVariablesOptions>
  | undefined
  | undefined;

export type ResolveEnvironmentVariablesParams = {
  projectRef: string;
  environment: string;
  env: Record<string, string>;
};

export type ResolveEnvironmentVariablesFunction = (
  params: ResolveEnvironmentVariablesParams,
) => ResolveEnvironmentVariablesResult;
