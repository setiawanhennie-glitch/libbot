import { timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { ASSISTANT_ID } from "@/lib/constants";
import { searchBookSegments } from "@/lib/actions/book.actions";

const NO_MATCHES = "No information found about this topic.";

type VapiToolCall = {
    id?: string;
    function?: {
        name?: string;
        arguments?: unknown;
    };
};

type VapiRequestBody = {
    message?: {
        toolCallList?: VapiToolCall[];
        call?: {
            assistantId?: string;
            assistantOverrides?: {
                variableValues?: Record<string, unknown>;
            };
        };
    };
};

export async function POST(request: Request) {
    const serverSecret = process.env.VAPI_SERVER_SECRET;
    const authorization = request.headers.get("authorization") ?? "";
    const expectedAuthorization = serverSecret ? Buffer.from(`Bearer ${serverSecret}`) : null;
    const receivedAuthorization = Buffer.from(authorization);

    if (
        !expectedAuthorization ||
        expectedAuthorization.length !== receivedAuthorization.length ||
        !timingSafeEqual(expectedAuthorization, receivedAuthorization)
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: VapiRequestBody;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const call = body.message?.call;
    const variableValues = call?.assistantOverrides?.variableValues;
    if (call?.assistantId !== ASSISTANT_ID || !variableValues) {
        return NextResponse.json({ error: "Unauthorized Vapi call" }, { status: 401 });
    }

    const toolCalls = body.message?.toolCallList;
    if (!Array.isArray(toolCalls)) {
        return NextResponse.json({ error: "Missing Vapi tool calls" }, { status: 400 });
    }

    const results = await Promise.all(
        toolCalls
            .filter((toolCall) => toolCall.function?.name?.toLowerCase() === "search book" && toolCall.id)
            .map(async (toolCall) => {
                let parameters = toolCall.function?.arguments;
                if (typeof parameters === "string") {
                    try {
                        parameters = JSON.parse(parameters);
                    } catch {
                        return { toolCallId: toolCall.id, result: NO_MATCHES };
                    }
                }

                if (!parameters || typeof parameters !== "object") {
                    return { toolCallId: toolCall.id, result: NO_MATCHES };
                }

                const args = parameters as { bookId?: unknown; query?: unknown };
                const bookId = args.bookId;
                const query = args.query;
                const callBookId = variableValues.bookId;
                const voiceSessionId = variableValues.voiceSessionId;

                if (
                    typeof bookId !== "string" ||
                    !Types.ObjectId.isValid(bookId) ||
                    bookId !== callBookId ||
                    typeof voiceSessionId !== "string" ||
                    !Types.ObjectId.isValid(voiceSessionId) ||
                    typeof query !== "string" ||
                    !query.trim()
                ) {
                    return { toolCallId: toolCall.id, result: NO_MATCHES };
                }

                try {
                    const searchResult = await searchBookSegments(bookId, query.trim(), 3, voiceSessionId);
                    const result = searchResult.success && searchResult.data.length
                        ? searchResult.data
                            .map((segment) => `Segment ${segment.segmentIndex}: ${segment.content}`)
                            .join("\n\n")
                        : NO_MATCHES;

                    return { toolCallId: toolCall.id, result };
                } catch (error) {
                    console.error("Error searching book segments", error);
                    return { toolCallId: toolCall.id, result: NO_MATCHES };
                }
            }),
    );

    return NextResponse.json({ results });
}