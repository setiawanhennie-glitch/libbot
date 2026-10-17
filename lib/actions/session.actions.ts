'use server';

import VoiceSession from "@/database/models/voice-session.model";
import Book from "@/database/models/book.model";
import { connectToDatabase } from "@/database/mongoose";
import { StartSessionResult, EndSessionResult } from "@/types"
import { getCurrentBillingPeriodStart } from "../subscription-constants";
import { auth } from "@clerk/nextjs/server";

export const startVoiceSession = async (bookId: string): Promise<StartSessionResult> => {
    try {
        const { userId } = await auth();
        if (!userId) return { success: false, error: "Unauthorized" };

        await connectToDatabase();

        const book = await Book.findOne({ _id: bookId, clerkId: userId }).select("_id").lean();
        if (!book) return { success: false, error: "Book not found" };

        const session = await VoiceSession.create({ 
            clerkId: userId,
            bookId, 
            startedAt : new Date(),
            billingPeriodStart: getCurrentBillingPeriodStart(),
            durationSeconds: 0,
        });

        return {
            success: true,
            sessionId: session._id.toString(),

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
        await connectToDatabase();

        const session = await VoiceSession.findByIdAndUpdate(
            sessionId,
            { endedAt: new Date(), durationSeconds },
        );

        if (!session) return { success: false, error: 'Voice session not found.' };

        return { success: true };
    } catch (e) {
        console.error('Error ending voice session', e);
        return { success: false, error: 'Failed to end voice session. Please try again later.' };
    }
}
