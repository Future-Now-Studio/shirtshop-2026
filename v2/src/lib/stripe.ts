import { loadStripe } from "@stripe/stripe-js";

const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

// Lazily resolves the Stripe.js instance. Returns null if no key is configured
// (so the app still builds before the key is set).
export const stripePromise = pk ? loadStripe(pk) : null;
