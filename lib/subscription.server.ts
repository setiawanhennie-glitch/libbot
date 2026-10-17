import { auth } from "@clerk/nextjs/server";
import { getPlanFromHas, type PlanType } from "@/lib/subscription-constants";

export const getServerSubscriptionContext = async (): Promise<{
    userId: string | null;
    plan: PlanType;
}> => {
    const { userId, has } = await auth();

    return {
        userId,
        plan: userId ? getPlanFromHas(has) : "free",
    };
};