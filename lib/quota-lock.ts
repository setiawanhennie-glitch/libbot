import "server-only";

import type { ClientSession } from "mongoose";
import UserQuotaLock from "@/database/models/user-quota-lock.model";
import { connectToDatabase } from "@/database/mongoose";

export const withUserQuotaLock = async <T>(
    userId: string,
    operation: (session: ClientSession) => Promise<T>,
): Promise<T> => {
    await connectToDatabase();

    try {
        await UserQuotaLock.updateOne(
            { _id: userId },
            { $setOnInsert: { revision: 0 } },
            { upsert: true },
        );
    } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
    }

    return UserQuotaLock.db.transaction(async (session) => {
        const lock = await UserQuotaLock.updateOne(
            { _id: userId },
            { $inc: { revision: 1 } },
            { session },
        );
        if (lock.matchedCount !== 1) throw new Error("Unable to acquire user quota lock");

        return operation(session);
    });
};