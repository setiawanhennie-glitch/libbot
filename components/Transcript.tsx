'use client';

import { Mic } from "lucide-react";
import { useEffect, useRef } from "react";
import { Messages } from "@/types";

interface TranscriptProps {
    messages: Messages[];
    currentMessage: string;
    currentUserMessage: string;
}

const Transcript = ({ messages, currentMessage, currentUserMessage }: TranscriptProps) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasConversation = messages.length > 0 || currentMessage.length > 0 || currentUserMessage.length > 0;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, currentMessage, currentUserMessage]);

    if (!hasConversation) {
        return (
            <div className="transcript-empty">
                <Mic aria-hidden="true" className="mb-4 size-12 text-[#3d485e]" />
                <p className="transcript-empty-text">No conversation yet</p>
                <p className="transcript-empty-hint">
                    Click the mic button above to start talking
                </p>
            </div>
        );
    }

    return (
        <div className="transcript-messages" aria-live="polite">
            {messages.map((message, index) => {
                const isUser = message.role === "user";

                return (
                    <div
                        key={`${index}-${message.role}`}
                        className={`transcript-message ${isUser ? "transcript-message-user" : "transcript-message-assistant"}`}
                    >
                        <p className={`transcript-bubble ${isUser ? "transcript-bubble-user" : "transcript-bubble-assistant"}`}>
                            {message.content}
                        </p>
                    </div>
                );
            })}
            {currentUserMessage && (
                <div className="transcript-message transcript-message-user">
                    <p className="transcript-bubble transcript-bubble-user">
                        {currentUserMessage}
                        <span className="transcript-cursor" aria-hidden="true" />
                    </p>
                </div>
            )}
            {currentMessage && (
                <div className="transcript-message transcript-message-assistant">
                    <p className="transcript-bubble transcript-bubble-assistant">
                        {currentMessage}
                        <span className="transcript-cursor" aria-hidden="true" />
                    </p>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default Transcript;
