'use server';

import VoiceSession from "@/database/models/voice-session.model";
import Book from "@/database/models/book.model";
import { connectToDatabase } from "@/database/mongoose";
import { StartSessionResult, EndSessionResult, VapiWebCall } from "@/types"
import { PLAN_LIMITS } from "../subscription-constants";
import { getServerSubscriptionContext } from "@/lib/subscription.server";
import { getServerBillingPeriod } from "@/lib/subscription.server";
import { withUserQuotaLock } from "@/lib/quota-lock";
import { ASSISTANT_ID, DEFAULT_VOICE, VOICE_SETTINGS } from "@/lib/constants";
import { getVoice } from "@/lib/utils";

export const startVoiceSession = async (bookId: string): Promise<StartSessionResult> => {
    try {
        const { userId, plan } = await getServerSubscriptionContext();
        if (!userId) return { success: false, error: "Unauthorized" };

        const vapiApiKey = process.env.VAPI_PRIVATE_API_KEY;
        if (!vapiApiKey) return { success: false, error: "Voice calling is not configured on the server." };

        await connectToDatabase();

        const book = await Book.findOne({ _id: bookId, clerkId: userId })
            .select("title author persona")
            .lean();
        if (!book) return { success: false, error: "Book not found" };

        const billingPeriod = await getServerBillingPeriod(userId, plan);
        const maxDurationSeconds = PLAN_LIMITS[plan].maxSessionMinutes * 60;
        const sessionLimit = PLAN_LIMITS[plan].maxSessionsPerMonth;
        const reservation = await withUserQuotaLock(userId, async (mongoSession) => {
            if (sessionLimit !== null) {
                const sessionsThisMonth = await VoiceSession.countDocuments({
                    clerkId: userId,
                    $or: [
                        { billingPeriodStart: billingPeriod.start },
                        {
                            billingPeriodStart: null,
                            startedAt: { $gte: billingPeriod.start, $lt: billingPeriod.end },
                        },
                    ],
                }).session(mongoSession);

                if (sessionsThisMonth >= sessionLimit) return { allowed: false as const };
            }

            const [session] = await VoiceSession.create([{
                clerkId: userId,
                bookId,
                startedAt: new Date(),
                billingPeriodStart: billingPeriod.start,
                durationSeconds: 0,
                maxDurationSeconds,
            }], { session: mongoSession });

            return { allowed: true as const, sessionId: session._id.toString() };
        });

        if (!reservation.allowed) {
            return {
                success: false,
                error: `Your ${plan} plan includes ${sessionLimit} voice sessions per billing period. Upgrade to continue.`,
                isBillingError: true,
            };
        }

        try {
            const voice = getVoice(book.persona || DEFAULT_VOICE);
            const response = await fetch("https://api.vapi.ai/call/web", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${vapiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    assistantId: ASSISTANT_ID,
                    assistantOverrides: {
                        firstMessage: `Hey, good to meet you. Quick question, before we dive in: have you actually read ${book.title} yet or are we starting fresh?`,
                        maxDurationSeconds,
                        variableValues: {
                            title: book.title,
                            author: book.author,
                            bookId,
                            voiceSessionId: reservation.sessionId,
                        },
                        voice: {
                            provider: "11labs",
                            voiceId: voice.id,
                            model: "eleven_turbo_v2_5",
                            stability: VOICE_SETTINGS.stability,
                            similarityBoost: VOICE_SETTINGS.similarityBoost,
                            style: VOICE_SETTINGS.style,
                            useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
                            speed: VOICE_SETTINGS.speed,
                        },
                    },
                }),
            });

            if (!response.ok) throw new Error(`Vapi call creation failed (${response.status})`);

            const webCall = await response.json() as VapiWebCall;
            if (typeof webCall.webCallUrl !== "string") throw new Error("Vapi did not return a web call URL");

            return {
                success: true,
                sessionId: reservation.sessionId,
                maxDurationMinutes: PLAN_LIMITS[plan].maxSessionMinutes,
                webCall,
            };
        } catch (error) {
            await VoiceSession.deleteOne({ _id: reservation.sessionId, clerkId: userId });
            throw error;
        }


    } catch (e) {
        console.error('Error starting voice session', e);
        return { success: false, error: 'Failed to start voice session. Please try again later.'}
    }
}

export const endVoiceSession = async (
    sessionId: string,
    durationSeconds: number,
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { userId } = await getServerSubscriptionContext();
        if (!userId) return { success: false, error: "Unauthorized" };

        await connectToDatabase();

        const session = await VoiceSession.findOne({ _id: sessionId, clerkId: userId });

        if (!session) return { success: false, error: 'Voice session not found.' };

        session.endedAt = new Date();
        session.durationSeconds = Math.min(
            Math.max(0, Math.floor(durationSeconds)),
            session.maxDurationSeconds ?? durationSeconds,
        );
        await session.save();

        return { success: true };
    } catch (e) {
        console.error('Error ending voice session', e);
        return { success: false, error: 'Failed to end voice session. Please try again later.' };
    }
}
