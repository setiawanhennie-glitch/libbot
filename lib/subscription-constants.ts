export const getCurrentBillingPeriodStart = (): Date => {
    const now = new Date();
    return new Date(now.getFullYear(), new.getMonth(), 1, 0, 0, 0, 0);
}