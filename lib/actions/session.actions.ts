'use server';

import VoiceSession from "@/database/models/voice-session.model";
import { connectToDatabase } from "@/database/mongoose";
import { StartSessionResult } from "@/types"
import { getCurrentBillingPeriodStart } from "../subscription-constants";

export const startVoiceSession = async (clerkId, bookId): Promise<StartSessionResult> => {
    try {
        await connectToDatabase();

        const session = await VoiceSession.create({ 
            clerkId, 
            bookId, 
            startedAt : new Date(),
            billingPeriodStart: getCurrentBillingPeriodStart(),
            durationSeconds: 0,
        });

    } catch (e) {
        console.error('Error starting voice session', e);
        return { success: false, error: 'Failed to start voice session. Please try again later.'}
    }
}