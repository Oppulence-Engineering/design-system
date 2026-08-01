import { Buffer } from "node:buffer";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { SIMSTUDIO_BASELINE } from "../../../catalog";
import type { IntegrationApiKeyRuntime } from "../../runtime/api-key";
import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderSdk } from "../../core/provider-sdk";
import {
  ProviderSdkInvocationSchema,
  definedFields,
  invokeSdkMethod,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputString,
  requiredInputString,
} from "../shared/sdk";

type ElevenLabsSdkClient = Record<string, unknown>;

type ElevenLabsClientFactory = (apiKey: string) => ElevenLabsSdkClient;

export interface ElevenLabsProviderSdkConfig {
  apiKeyRuntime: Pick<IntegrationApiKeyRuntime, "withCredential">;
  clientFactory?: ElevenLabsClientFactory;
  /** Maximum decoded size accepted for an input or generated audio payload. */
  maxAudioBytes?: number;
}

function createElevenLabsClient(apiKey: string): ElevenLabsSdkClient {
  return new ElevenLabsClient({ apiKey }) as unknown as ElevenLabsSdkClient;
}

const ELEVENLABS_OPERATION_IDS = Object.freeze(
  (
    SIMSTUDIO_BASELINE.integrations.find(
      (integration) => integration.id === "elevenlabs",
    )?.operations ?? []
  ).map((operation) => operation.id),
);

const ELEVENLABS_AUDIO_OPERATION_IDS = new Set([
  "elevenlabs:text-to-speech",
  "elevenlabs:sound-effects",
  "elevenlabs:speech-to-speech",
  "elevenlabs:audio-isolation",
]);

interface ElevenLabsSdkRequest {
  path: readonly string[];
  arguments: readonly unknown[];
}

function elevenLabsRequest(
  path: readonly string[],
  ...arguments_: readonly unknown[]
): ElevenLabsSdkRequest {
  return { path, arguments: arguments_ };
}

function elevenLabsVoiceSettings(
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  const voiceSettings = definedFields({
    stability: optionalInputNumber(input, "stability"),
    similarityBoost: optionalInputNumber(input, "similarityBoost"),
    style: optionalInputNumber(input, "style"),
    useSpeakerBoost: optionalInputBoolean(input, "useSpeakerBoost"),
    speed: optionalInputNumber(input, "speed"),
  });
  for (const value of [
    voiceSettings.stability,
    voiceSettings.similarityBoost,
    voiceSettings.style,
  ]) {
    if (typeof value === "number" && (value < 0 || value > 1)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
  }
  return Object.keys(voiceSettings).length ? voiceSettings : undefined;
}

function elevenLabsAudioUpload(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): Record<string, unknown> {
  const rawFile = input.audioFile;
  if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const file = rawFile as Record<string, unknown>;
  const encoded = optionalInputString(file, "base64", "data", "content");
  if (!encoded || !/^[A-Za-z0-9+/_=-]*$/u.test(encoded)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  const data = Buffer.from(encoded, "base64");
  if (!data.byteLength || data.byteLength > maximumBytes) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return {
    data,
    filename: optionalInputString(file, "filename", "name") ?? "audio",
    contentType:
      optionalInputString(file, "mimeType", "contentType", "type") ??
      "application/octet-stream",
    contentLength: data.byteLength,
  };
}

function elevenLabsOutputMimeType(
  input: Readonly<Record<string, unknown>>,
): string {
  const outputFormat = optionalInputString(input, "outputFormat");
  if (outputFormat?.startsWith("wav")) return "audio/wav";
  if (outputFormat?.startsWith("pcm")) return "audio/pcm";
  if (outputFormat?.startsWith("ulaw") || outputFormat?.startsWith("alaw")) {
    return "audio/basic";
  }
  return "audio/mpeg";
}

async function elevenLabsAudioOutput(
  value: unknown,
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
): Promise<Record<string, unknown>> {
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as ReadableStream<Uint8Array>).getReader !== "function"
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
    );
  }
  const reader = (value as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > maximumBytes) {
      void reader.cancel().catch(() => undefined);
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
      );
    }
    chunks.push(next.value);
  }
  const audio = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const mimeType = elevenLabsOutputMimeType(input);
  const data = audio.toString("base64");
  return {
    audioBase64: data,
    mimeType,
    byteLength: audio.byteLength,
    // The package cannot invent a durable URL. Products can persist this
    // portable payload with their existing file service if they need one.
    audioFile: {
      data,
      encoding: "base64",
      mimeType,
      byteLength: audio.byteLength,
    },
  };
}

function elevenLabsOptionalPageSize(
  input: Readonly<Record<string, unknown>>,
): number | undefined {
  const pageSize = optionalInputNumber(input, "pageSize");
  if (pageSize === undefined) return undefined;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return pageSize;
}

function elevenLabsAudioRequest(
  input: Readonly<Record<string, unknown>>,
  maximumBytes: number,
  operationId: string,
): ElevenLabsSdkRequest {
  if (operationId === "elevenlabs:text-to-speech") {
    return elevenLabsRequest(
      ["textToSpeech", "convert"],
      requiredInputString(input, "voiceId"),
      definedFields({
        text: requiredInputString(input, "text"),
        modelId: optionalInputString(input, "modelId"),
        outputFormat: optionalInputString(input, "outputFormat"),
        voiceSettings: elevenLabsVoiceSettings(input),
      }),
    );
  }
  if (operationId === "elevenlabs:sound-effects") {
    const durationSeconds = optionalInputNumber(input, "durationSeconds");
    const promptInfluence = optionalInputNumber(input, "promptInfluence");
    if (
      (durationSeconds !== undefined &&
        (durationSeconds < 0.5 || durationSeconds > 30)) ||
      (promptInfluence !== undefined &&
        (promptInfluence < 0 || promptInfluence > 1))
    ) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return elevenLabsRequest(
      ["textToSoundEffects", "convert"],
      definedFields({
        text: requiredInputString(input, "text"),
        modelId: optionalInputString(input, "modelId"),
        outputFormat: optionalInputString(input, "outputFormat"),
        durationSeconds,
        promptInfluence,
        loop: optionalInputBoolean(input, "loop"),
      }),
    );
  }
  if (operationId === "elevenlabs:speech-to-speech") {
    return elevenLabsRequest(
      ["speechToSpeech", "convert"],
      requiredInputString(input, "voiceId"),
      definedFields({
        audio: elevenLabsAudioUpload(input, maximumBytes),
        modelId: optionalInputString(input, "modelId"),
        outputFormat: optionalInputString(input, "outputFormat"),
        removeBackgroundNoise: optionalInputBoolean(
          input,
          "removeBackgroundNoise",
        ),
      }),
    );
  }
  return elevenLabsRequest(
    ["audioIsolation", "convert"],
    definedFields({
      audio: elevenLabsAudioUpload(input, maximumBytes),
      fileFormat: optionalInputString(input, "fileFormat"),
    }),
  );
}

const ELEVENLABS_OPERATION_REQUESTS: Readonly<
  Record<
    string,
    (input: Readonly<Record<string, unknown>>) => ElevenLabsSdkRequest
  >
> = {
  "elevenlabs:list-voices": (input) =>
    elevenLabsRequest(
      ["voices", "search"],
      definedFields({
        search: optionalInputString(input, "search"),
        category: optionalInputString(input, "category"),
        pageSize: elevenLabsOptionalPageSize(input),
        nextPageToken: optionalInputString(input, "nextPageToken"),
      }),
    ),
  "elevenlabs:get-voice": (input) =>
    elevenLabsRequest(
      ["voices", "get"],
      requiredInputString(input, "voiceId"),
      { withSettings: true },
    ),
  "elevenlabs:get-voice-settings": (input) =>
    elevenLabsRequest(
      ["voices", "settings", "get"],
      requiredInputString(input, "voiceId"),
    ),
  "elevenlabs:edit-voice-settings": (input) => {
    const voiceSettings = elevenLabsVoiceSettings(input);
    if (!voiceSettings) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
    return elevenLabsRequest(
      ["voices", "settings", "update"],
      requiredInputString(input, "voiceId"),
      voiceSettings,
    );
  },
  "elevenlabs:list-models": () => elevenLabsRequest(["models", "list"]),
  "elevenlabs:get-user-info": () => elevenLabsRequest(["user", "get"]),
};

function assertElevenLabsOperationCoverage(): void {
  const expected = new Set(ELEVENLABS_OPERATION_IDS);
  const implemented = new Set([
    ...Object.keys(ELEVENLABS_OPERATION_REQUESTS),
    ...ELEVENLABS_AUDIO_OPERATION_IDS,
  ]);
  if (
    expected.size !== implemented.size ||
    [...implemented].some((operationId) => !expected.has(operationId))
  ) {
    throw new Error(
      "ElevenLabs provider SDK operation coverage is incomplete.",
    );
  }
}

/**
 * All pinned ElevenLabs actions use the official SDK. Generated audio is
 * returned as a bounded portable payload; storage and any durable URL remain
 * product-owned business logic.
 */
export function createElevenLabsProviderSdk(
  config: ElevenLabsProviderSdkConfig,
): IntegrationProviderSdk {
  assertElevenLabsOperationCoverage();
  const maximumAudioBytes = config.maxAudioBytes ?? 25 * 1024 * 1024;
  if (
    !Number.isSafeInteger(maximumAudioBytes) ||
    maximumAudioBytes < 1_024 ||
    maximumAudioBytes > 100 * 1024 * 1024
  ) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_CONFIGURATION_INVALID",
    );
  }
  const clientFactory = config.clientFactory ?? createElevenLabsClient;
  return {
    integrationId: "elevenlabs",
    operationIds: ELEVENLABS_OPERATION_IDS,
    async execute(rawInput) {
      const parsed = ProviderSdkInvocationSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
        );
      }
      const invocation = parsed.data;
      if (
        invocation.integrationId !== "elevenlabs" ||
        invocation.reference.integrationId !== "elevenlabs"
      ) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_CONNECTION_MISMATCH",
        );
      }
      const request = ELEVENLABS_AUDIO_OPERATION_IDS.has(invocation.operationId)
        ? elevenLabsAudioRequest(
            invocation.input,
            maximumAudioBytes,
            invocation.operationId,
          )
        : ELEVENLABS_OPERATION_REQUESTS[invocation.operationId]?.(
            invocation.input,
          );
      if (!request) {
        throw new IntegrationProviderSdkError(
          "INTEGRATION_PROVIDER_SDK_OPERATION_UNAVAILABLE",
        );
      }
      return config.apiKeyRuntime.withCredential(
        invocation.reference,
        async (credential) => {
          const response = await invokeSdkMethod(
            clientFactory(credential.apiKey),
            request,
          );
          return {
            operationId: invocation.operationId,
            output: ELEVENLABS_AUDIO_OPERATION_IDS.has(invocation.operationId)
              ? await elevenLabsAudioOutput(
                  response,
                  invocation.input,
                  maximumAudioBytes,
                )
              : response,
          };
        },
      );
    },
  };
}

export function getElevenLabsProviderSdkReport(): {
  operations: number;
  operationIds: readonly string[];
} {
  assertElevenLabsOperationCoverage();
  return {
    operations: ELEVENLABS_OPERATION_IDS.length,
    operationIds: ELEVENLABS_OPERATION_IDS,
  };
}
