export type PlanType = "free" | "standard" | "pro";

export const PLAN_LIMITS = {
    free: {
        maxBooks: 1,
        maxSessionsPerMonth: 5,
        maxSessionMinutes: 5,
        hasSessionHistory: false,
    },
    standard: {
        maxBooks: 10,
        maxSessionsPerMonth: 100,
        maxSessionMinutes: 15,
        hasSessionHistory: true,
    },
    pro: {
        maxBooks: 100,
        maxSessionsPerMonth: null,
        maxSessionMinutes: 60,
        hasSessionHistory: true,
    },
} as const;

export type PlanHasChecker = (params: { plan: string }) => boolean;

export const getPlanFromHas = (has: PlanHasChecker): PlanType => {
    if (has({ plan: "pro" })) return "pro";
    if (has({ plan: "standard" })) return "standard";
    return "free";
};

export const getCurrentBillingPeriodStart = (): Date => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}