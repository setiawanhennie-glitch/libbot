import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCurrentBillingPeriodStart, getPlanFromHas, type PlanType } from "@/lib/subscription-constants";

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

export const getServerBillingPeriod = async (
    userId: string,
    plan: PlanType,
): Promise<{ start: Date; end: Date }> => {
    if (plan === "free") {
        const start = getCurrentBillingPeriodStart();
        return {
            start,
            end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)),
        };
    }

    const client = await clerkClient();
    const subscription = await client.billing.getUserBillingSubscription(userId);
    const item = subscription.subscriptionItems.find(
        (subscriptionItem) => subscriptionItem.status === "active" && subscriptionItem.plan?.slug === plan,
    );

    if (!item) throw new Error(`Active ${plan} billing period was not found`);

    const start = getCurrentBillingPeriodStart(item.periodStart);
    return {
        start,
        end: item.periodEnd === null
            ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
            : new Date(item.periodEnd),
    };
};