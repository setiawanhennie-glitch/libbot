import { PricingTable } from "@clerk/nextjs";

export default function SubscriptionsPage() {
    return (
        <main className="clerk-subscriptions">
            <header className="mb-10 max-w-2xl text-center">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#663820]">
                    LibBot plans
                </p>
                <h1 className="page-title">A bigger library for deeper conversations</h1>
                <p className="page-description text-[var(--text-secondary)]">
                    Choose the plan that fits the way you read and explore.
                </p>
            </header>
            <section className="clerk-pricing-table" aria-label="Subscription plans">
                <PricingTable
                    for="user"
                    highlightedPlan="standard"
                    newSubscriptionRedirectUrl="/"
                    appearance={{
                        variables: {
                            colorPrimary: "#663820",
                            colorBackground: "#ffffff",
                            borderRadius: "0.5rem",
                        },
                    }}
                />
            </section>
        </main>
    );
}