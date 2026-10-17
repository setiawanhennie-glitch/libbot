import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { searchBookSegments } from "@/lib/actions/book.actions";

const NO_MATCHES = "No information found about this topic.";

type VapiToolCall = {
    id?: string;
    name?: string;
    parameters?: {
        bookId?: unknown;
        query?: unknown;
    };
};

export async function POST(request: Request) {
    let body: { message?: { toolCallList?: VapiToolCall[] } };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const toolCalls = body.message?.toolCallList;
    if (!Array.isArray(toolCalls)) {
        return NextResponse.json({ error: "Missing Vapi tool calls" }, { status: 400 });
    }

    const results = await Promise.all(
        toolCalls
            .filter((toolCall) => toolCall.name?.toLowerCase() === "search book" && toolCall.id)
            .map(async (toolCall) => {
                const bookId = toolCall.parameters?.bookId;
                const query = toolCall.parameters?.query;

                if (
                    typeof bookId !== "string" ||
                    !Types.ObjectId.isValid(bookId) ||
                    typeof query !== "string" ||
                    !query.trim()
                ) {
                    return { toolCallId: toolCall.id, result: NO_MATCHES };
                }

                try {
                    const searchResult = await searchBookSegments(bookId, query.trim(), 3);
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