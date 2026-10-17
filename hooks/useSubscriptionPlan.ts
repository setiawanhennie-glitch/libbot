"use client";

import { useAuth } from "@clerk/nextjs";
import { getPlanFromHas, PLAN_LIMITS } from "@/lib/subscription-constants";

export const useSubscriptionPlan = () => {
    const { has, isLoaded, isSignedIn } = useAuth();
    const plan = isLoaded && isSignedIn ? getPlanFromHas(has) : "free";

    return {
        isLoaded,
        plan,
        limits: PLAN_LIMITS[plan],
    };
};