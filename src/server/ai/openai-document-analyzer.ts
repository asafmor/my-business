import "server-only";

import {
  analyzedDocumentExtractionSchema,
  documentExtractionSchemaVersion,
  DocumentAnalyzerError,
} from "./document-analyzer";
import type {
  DocumentAnalyzer,
  DocumentAnalyzerInput,
  DocumentAnalyzerOutput,
} from "./document-analyzer";
import type { JsonObject } from "../../domain/documents/types";
import { documentTypes } from "../../domain/documents/types";

const supportedModels = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o"] as const;
type OpenAiModel = (typeof supportedModels)[number];

const extractionJsonSchema = {
  additionalProperties: false,
  properties: {
    anomalies: { items: { type: "string" }, type: "array" },
    confidence: { type: "number" },
    currency: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    documentNumber: { type: ["string", "null"] },
    documentType: { enum: [...documentTypes, null] },
    lineItems: {
      items: {
        additionalProperties: false,
        properties: {
          description: { type: ["string", "null"] },
          quantity: { type: ["string", "null"] },
          total: { type: ["string", "null"] },
          unitPrice: { type: ["string", "null"] },
          vat: { type: ["string", "null"] },
        },
        required: ["description", "quantity", "total", "unitPrice", "vat"],
        type: "object",
      },
      type: "array",
    },
    paymentMethod: { type: ["string", "null"] },
    subtotal: { type: ["string", "null"] },
    suggestedCategory: { type: ["string", "null"] },
    supplierIdentifier: { type: ["string", "null"] },
    supplierName: { type: ["string", "null"] },
    total: { type: ["string", "null"] },
    transactionDate: { type: ["string", "null"] },
    vat: { type: ["string", "null"] },
  },
  required: [
    "anomalies",
    "confidence",
    "currency",
    "description",
    "documentNumber",
    "documentType",
    "lineItems",
    "paymentMethod",
    "subtotal",
    "suggestedCategory",
    "supplierIdentifier",
    "supplierName",
    "total",
    "transactionDate",
    "vat",
  ],
  type: "object",
} as const;

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type OpenAiDocumentAnalyzerDependencies = {
  fetch: FetchLike;
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractOutputText(response: JsonObject): string | null {
  if (typeof response.output_text === "string") return response.output_text;
  const output = response.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!isJsonObject(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isJsonObject(content) && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

function documentContent(input: DocumentAnalyzerInput) {
  const dataUrl = `data:${input.mimeType};base64,${Buffer.from(input.content).toString("base64")}`;
  if (input.mimeType === "application/pdf") {
    return { file_data: dataUrl, type: "input_file" };
  }
  return { image_url: dataUrl, type: "input_image" };
}

function getOpenAiModel(
  environment: Record<string, string | undefined>,
): OpenAiModel {
  const configured = environment.OPENAI_MODEL ?? "gpt-4.1-mini";
  if (!supportedModels.includes(configured as OpenAiModel)) {
    throw new Error("OPENAI_MODEL must be an approved server-side model.");
  }
  return configured as OpenAiModel;
}

export class OpenAiDocumentAnalyzer implements DocumentAnalyzer {
  constructor(
    private readonly configuration: { apiKey: string; model: OpenAiModel },
    private readonly dependencies: OpenAiDocumentAnalyzerDependencies = {
      fetch: globalThis.fetch,
    },
  ) {}

  async analyze(input: DocumentAnalyzerInput): Promise<DocumentAnalyzerOutput> {
    let response: Response;
    try {
      response = await this.dependencies.fetch(
        "https://api.openai.com/v1/responses",
        {
          body: JSON.stringify({
            input: [
              {
                content: [
                  {
                    text: `Extract bookkeeping fields from this document. Use null when a value is not visible. Money must use decimal cents (for example 117.00). Suggested category must be one of: ${input.categoryNames.join(", ") || "none"}. Do not infer missing values.`,
                    type: "input_text",
                  },
                  documentContent(input),
                ],
                role: "user",
              },
            ],
            model: this.configuration.model,
            text: {
              format: {
                name: "document_extraction",
                schema: extractionJsonSchema,
                strict: true,
                type: "json_schema",
              },
            },
          }),
          headers: {
            Authorization: `Bearer ${this.configuration.apiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
    } catch (error) {
      throw new DocumentAnalyzerError(
        "OpenAI document analysis failed.",
        {
          model: this.configuration.model,
          provider: "openai",
          schemaVersion: documentExtractionSchemaVersion,
        },
        { cause: error },
      );
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error) {
      throw new DocumentAnalyzerError(
        "OpenAI returned an unreadable response.",
        {
          model: this.configuration.model,
          provider: "openai",
          schemaVersion: documentExtractionSchemaVersion,
        },
        { cause: error },
      );
    }

    if (!response.ok || !isJsonObject(raw)) {
      throw new DocumentAnalyzerError("OpenAI document analysis failed.", {
        model: this.configuration.model,
        provider: "openai",
        schemaVersion: documentExtractionSchemaVersion,
      });
    }

    const outputText = extractOutputText(raw);
    if (!outputText) {
      throw new DocumentAnalyzerError(
        "OpenAI returned no structured extraction.",
        {
          model: this.configuration.model,
          provider: "openai",
          rawResult: raw,
          schemaVersion: documentExtractionSchemaVersion,
        },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch (error) {
      throw new DocumentAnalyzerError(
        "OpenAI returned invalid extraction JSON.",
        {
          model: this.configuration.model,
          provider: "openai",
          rawResult: raw,
          schemaVersion: documentExtractionSchemaVersion,
        },
        { cause: error },
      );
    }
    const extraction = analyzedDocumentExtractionSchema.safeParse(parsed);
    if (!extraction.success) {
      throw new DocumentAnalyzerError(
        "OpenAI returned an invalid extraction shape.",
        {
          model: this.configuration.model,
          provider: "openai",
          rawResult: raw,
          schemaVersion: documentExtractionSchemaVersion,
        },
      );
    }

    return {
      extraction: extraction.data,
      model: this.configuration.model,
      provider: "openai",
      rawResult: raw,
      schemaVersion: documentExtractionSchemaVersion,
    };
  }
}

export function getOpenAiDocumentAnalyzer(
  environment: Record<string, string | undefined> = process.env,
): OpenAiDocumentAnalyzer {
  if (!environment.OPENAI_API_KEY) {
    throw new Error("Missing application variable: OPENAI_API_KEY.");
  }
  return new OpenAiDocumentAnalyzer({
    apiKey: environment.OPENAI_API_KEY,
    model: getOpenAiModel(environment),
  });
}
