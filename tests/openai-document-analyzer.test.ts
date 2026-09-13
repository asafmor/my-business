import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  documentExtractionSchemaVersion,
  DocumentAnalyzerError,
} from "../src/server/ai/document-analyzer";
import { OpenAiDocumentAnalyzer } from "../src/server/ai/openai-document-analyzer";

describe("OpenAI document analyzer", () => {
  it("sends original bytes server-side with strict JSON output requirements", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            anomalies: [],
            confidence: 0.95,
            currency: "ILS",
            description: null,
            documentNumber: null,
            documentType: "RECEIPT",
            lineItems: [],
            paymentMethod: null,
            subtotal: "100.00",
            suggestedCategory: "Office supplies",
            supplierIdentifier: null,
            supplierName: "Office Depot",
            total: "117.00",
            transactionDate: "2026-09-13",
            vat: "17.00",
          }),
        }),
        { status: 200 },
      ),
    );
    const analyzer = new OpenAiDocumentAnalyzer(
      { apiKey: "test-key", model: "gpt-4.1-mini" },
      { fetch },
    );

    await expect(
      analyzer.analyze({
        categoryNames: ["Office supplies"],
        content: new Uint8Array([1, 2, 3]),
        mimeType: "application/pdf",
      }),
    ).resolves.toMatchObject({
      provider: "openai",
      schemaVersion: documentExtractionSchemaVersion,
    });
    const request = JSON.parse(fetch.mock.calls[0][1].body) as {
      input: {
        content: { file_data?: string; filename?: string; type: string }[];
      }[];
      text: { format: { strict: boolean; type: string } };
    };
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer test-key",
    );
    expect(request.input[0].content[1]).toMatchObject({
      file_data: "data:application/pdf;base64,AQID",
      filename: "document.pdf",
      type: "input_file",
    });
    expect(request.text.format).toMatchObject({
      strict: true,
      type: "json_schema",
    });
  });

  it("rejects invalid provider JSON without logging its raw content", async () => {
    const rawResult = { output_text: "not valid JSON" };
    const analyzer = new OpenAiDocumentAnalyzer(
      { apiKey: "test-key", model: "gpt-4.1-mini" },
      {
        fetch: vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify(rawResult))),
      },
    );

    await expect(
      analyzer.analyze({
        categoryNames: [],
        content: new Uint8Array([1]),
        mimeType: "image/jpeg",
      }),
    ).rejects.toMatchObject({
      details: expect.objectContaining({ rawResult }),
    } satisfies Partial<DocumentAnalyzerError>);
  });
});
