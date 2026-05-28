import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/stores/cartStore";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { PaymentElement, Elements, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { ArrowLeft, Package, Truck, CreditCard, Lock, Loader2 } from "lucide-react";
import type { StripeElementsOptions } from "@stripe/stripe-js";

// Initialize Stripe - Get publishable key from environment
// IMPORTANT: 
// - Use your PUBLISHABLE key (pk_test_...) here, NOT the secret key
// - Secret keys (sk_test_...) should ONLY be used on your backend server
// - Get your publishable key from: https://dashboard.stripe.com/test/apikeys
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
).catch((error) => {
  // Return null to indicate Stripe failed to load
  return null;
});

interface ShippingFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

const SHIPPING_COST = 4.95; // Standard shipping cost in EUR
const FREE_SHIPPING_THRESHOLD = 50; // Minimum order value for free shipping in EUR

interface CheckoutFormProps {
  paymentIntentId?: string | null;
}

const CheckoutForm = ({ paymentIntentId }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [useExpressCheckout, setUseExpressCheckout] = useState(false);
  const [shippingForm, setShippingForm] = useState<ShippingFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "Deutschland",
  });

  const subtotal = getTotalPrice();
  const hasFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = items.length > 0 && !hasFreeShipping ? SHIPPING_COST : 0;
  const total = subtotal + shipping;

  const handleInputChange = (field: keyof ShippingFormData, value: string) => {
    setShippingForm((prev) => ({ ...prev, [field]: value }));
  };

  // Listen for payment method changes to detect express checkout
  useEffect(() => {
    if (!elements) return;

    const handleChange = (event: any) => {
      // Check if express payment method is selected
      const paymentMethod = event.value?.type;
      if (paymentMethod === 'paypal' || paymentMethod === 'link' || paymentMethod === 'apple_pay' || paymentMethod === 'google_pay') {
        setUseExpressCheckout(true);
      } else {
        setUseExpressCheckout(false);
      }
    };

    const element = elements.getElement('payment');
    if (element) {
      element.on('change', handleChange);
      return () => {
        element.off('change', handleChange);
      };
    }
  }, [elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Only validate shipping form if not using express checkout
    if (!useExpressCheckout) {
      const requiredFields: Array<{ field: keyof ShippingFormData; id: string; label: string }> = [
        { field: 'firstName', id: 'firstName', label: 'Vorname' },
        { field: 'lastName', id: 'lastName', label: 'Nachname' },
        { field: 'email', id: 'email', label: 'E-Mail-Adresse' },
        { field: 'address', id: 'address', label: 'Straße und Hausnummer' },
        { field: 'postalCode', id: 'postalCode', label: 'Postleitzahl' },
        { field: 'city', id: 'city', label: 'Stadt' },
      ];

      for (const { field, id, label } of requiredFields) {
        if (!shippingForm[field]) {
          toast.error(`Bitte füllen Sie "${label}" aus`);
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          document.getElementById(id)?.focus();
          return;
        }
      }

      if (!emailRegex.test(shippingForm.email)) {
        toast.error("Bitte geben Sie eine gültige E-Mail-Adresse ein");
        document.getElementById('email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('email')?.focus();
        return;
      }
    } else {
      // For express checkout, only email is required
      if (!shippingForm.email) {
        toast.error("Bitte geben Sie Ihre E-Mail-Adresse ein");
        document.getElementById('express-email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('express-email')?.focus();
        return;
      }
      if (!emailRegex.test(shippingForm.email)) {
        toast.error("Bitte geben Sie eine gültige E-Mail-Adresse ein");
        document.getElementById('express-email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('express-email')?.focus();
        return;
      }
    }

    setIsProcessing(true);

    try {
      // In a real application, you would create a PaymentIntent on your backend
      // For now, we'll use a mock approach - you'll need to implement the backend
      const { error: submitError } = await elements.submit();
      if (submitError) {
        toast.error(submitError.message || "Fehler bei der Zahlungsdatenüberprüfung");
        setIsProcessing(false);
        return;
      }

      // Confirm payment with Stripe
      const confirmParams: any = {
        return_url: `${window.location.origin}/checkout/success`,
      };

      // For express checkout, billing details come from the payment method itself
      // For regular checkout, provide billing details from the form
      if (!useExpressCheckout && shippingForm.firstName && shippingForm.lastName) {
        // Regular checkout - provide all billing details
        confirmParams.payment_method_data = {
          billing_details: {
            name: `${shippingForm.firstName} ${shippingForm.lastName}`,
            email: shippingForm.email,
            phone: shippingForm.phone || undefined,
            address: {
              line1: shippingForm.address,
              city: shippingForm.city,
              postal_code: shippingForm.postalCode,
              country: shippingForm.country === 'Deutschland' ? 'DE' : shippingForm.country,
            },
          },
        };
      } else if (useExpressCheckout && shippingForm.email) {
        // Express checkout - provide email, payment method will provide the rest
        confirmParams.payment_method_data = {
          billing_details: {
            email: shippingForm.email,
            // Name is required by Stripe, but for express checkout it will be overridden by payment method
            name: shippingForm.firstName && shippingForm.lastName 
              ? `${shippingForm.firstName} ${shippingForm.lastName}` 
              : 'Customer',
          },
        };
      } else {
        // Fallback - require valid email
        if (!shippingForm.email) {
          toast.error("Bitte geben Sie Ihre E-Mail-Adresse ein");
          setIsProcessing(false);
          return;
        }
        confirmParams.payment_method_data = {
          billing_details: {
            email: shippingForm.email,
            name: shippingForm.firstName && shippingForm.lastName
              ? `${shippingForm.firstName} ${shippingForm.lastName}`
              : 'Kunde',
          },
        };
      }

      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams,
        redirect: 'if_required', // Don't redirect automatically, handle it ourselves
      });

      if (paymentError) {
        toast.error(paymentError.message || "Zahlung fehlgeschlagen");
        setIsProcessing(false);
        return;
      }

      // Payment succeeded - NOW create WooCommerce order
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        try {
          const apiUrl = '/api';
          
          // Get billing details from payment intent if express checkout was used
          let billingData = {
            firstName: shippingForm.firstName,
            lastName: shippingForm.lastName,
            email: shippingForm.email,
            phone: shippingForm.phone,
            address: shippingForm.address,
            city: shippingForm.city,
            postalCode: shippingForm.postalCode,
            country: shippingForm.country,
          };

          // If express checkout, billing details should come from the payment method
          // For express checkout, we'll use the email from the form and let WooCommerce handle the rest
          // The payment method will have the address information
          
          // Create WooCommerce order
          const orderResponse = await fetch(`${apiUrl}/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: items,
              shipping: {
                total: shipping,
              },
              billing: billingData,
              paymentIntentId: paymentIntent.id,
              transactionId: paymentIntent.id,
              total: total,
            }),
          });

            if (!orderResponse.ok) {
              const errorText = await orderResponse.text();
              let errorMessage = 'Failed to create order';
              try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error || errorMessage;
              } catch (e) {
                errorMessage = errorText.substring(0, 200) || errorMessage;
              }
              console.error('Order creation failed:', {
                status: orderResponse.status,
                statusText: orderResponse.statusText,
                error: errorMessage,
              });
              throw new Error(errorMessage);
            }

            const orderData = await orderResponse.json();
            
            if (orderData.success) {
              // Order created successfully - clear cart and redirect
              clearCart();
              toast.success(`Bestellung #${orderData.orderNumber} wurde erfolgreich erstellt!`);
              navigate('/checkout/success', { 
                state: { orderId: orderData.orderId, orderNumber: orderData.orderNumber }
              });
            } else {
              throw new Error(orderData.error || 'Order creation returned unsuccessful');
            }
        } catch (orderError: any) {
          const errorMessage = orderError?.message || orderError?.toString() || 'Unknown error';
          // Payment succeeded but order creation failed - this is critical!
          toast.error(`Zahlung erfolgreich, aber Bestellung konnte nicht erstellt werden. Bitte kontaktieren Sie uns mit Ihrer Payment Intent ID: ${paymentIntent.id}`);
          console.error("Full error details:", {
            paymentIntentId: paymentIntent.id,
            error: errorMessage,
            items: items,
          });
          // Still redirect to success but with warning
          clearCart();
          navigate('/checkout/success', { 
            state: { 
              warning: true,
              paymentIntentId: paymentIntent.id,
              error: errorMessage
            }
          });
        }
      } else {
        // Payment not yet succeeded (might be processing)
        // Redirect to success page which will handle the status
        clearCart();
        navigate('/checkout/success');
      }
    } catch (error) {
      toast.error("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container-wide py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">Ihr Warenkorb ist leer</h1>
            <p className="text-muted-foreground mb-6">
              Fügen Sie Produkte hinzu, um fortzufahren
            </p>
            <Button onClick={() => navigate("/produkte")}>
              Produkte durchsuchen
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column - Shipping & Payment */}
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          {/* Shipping Information - Only show if not using express checkout */}
          {!useExpressCheckout && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Truck className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Versandinformationen</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Vorname *</Label>
                <Input
                  id="firstName"
                  value={shippingForm.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Nachname *</Label>
                <Input
                  id="lastName"
                  value={shippingForm.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="email">E-Mail-Adresse *</Label>
                <Input
                  id="email"
                  type="email"
                  value={shippingForm.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="phone">Telefonnummer</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={shippingForm.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address">Straße und Hausnummer *</Label>
                <Input
                  id="address"
                  value={shippingForm.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="postalCode">Postleitzahl *</Label>
                <Input
                  id="postalCode"
                  value={shippingForm.postalCode}
                  onChange={(e) => handleInputChange("postalCode", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="city">Stadt *</Label>
                <Input
                  id="city"
                  value={shippingForm.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="country">Land</Label>
                <Input
                  id="country"
                  value={shippingForm.country}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                />
              </div>
            </div>
          </motion.div>
          )}

          {/* Email field for express checkout */}
          {useExpressCheckout && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Truck className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Kontaktinformationen</h2>
              </div>
              <div>
                <Label htmlFor="express-email">E-Mail-Adresse *</Label>
                <Input
                  id="express-email"
                  type="email"
                  value={shippingForm.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="ihre@email.de"
                  required
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Ihre Versandadresse wird von Ihrer Zahlungsmethode übernommen
                </p>
              </div>
            </motion.div>
          )}

          {/* Payment Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Zahlungsinformationen</h2>
            </div>

            <div className="space-y-4">
              <PaymentElement
                options={{
                  layout: "tabs",
                  paymentMethodOrder: ['paypal', 'link', 'apple_pay', 'google_pay', 'card'], // Express methods first
                  fields: {
                    billingDetails: 'auto', // Let Stripe handle billing details collection
                  },
                }}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Lock className="w-3 h-3" />
                Ihre Zahlungsdaten werden sicher verarbeitet
              </p>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Order Summary (shown first on mobile) */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-4 sm:p-6 lg:sticky lg:top-28"
          >
            <h2 className="text-xl font-bold mb-6">Bestellübersicht</h2>

            {/* Order Items */}
            <div className="space-y-4 mb-6">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={item.customDesign || item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.color} / {item.size} × {item.quantity}
                    </p>
                    <p className="font-bold text-primary text-sm mt-1">
                      {(item.price * item.quantity).toFixed(2).replace(".", ",")} €
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span>{subtotal.toFixed(2).replace(".", ",")} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Versand
                  {hasFreeShipping && (
                    <span className="text-primary font-semibold ml-1">(kostenlos)</span>
                  )}
                </span>
                <span className={hasFreeShipping ? "text-primary line-through text-muted-foreground" : ""}>
                  {shipping.toFixed(2).replace(".", ",")} €
                </span>
              </div>
              {hasFreeShipping && (
                <div className="bg-primary/10 rounded-lg p-2 text-center">
                  <p className="text-xs font-semibold text-primary">
                    🎉 Kostenloser Versand!
                  </p>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Gesamt</span>
                <span className="text-primary">{total.toFixed(2).replace(".", ",")} €</span>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full mt-6"
              disabled={isProcessing || !stripe || !elements}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Wird verarbeitet…
                </span>
              ) : (
                `Jetzt zahlen (${total.toFixed(2).replace(".", ",")} €)`
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Durch Klicken auf "Jetzt zahlen" stimmen Sie unseren AGB zu
            </p>
          </motion.div>
        </div>
      </div>
    </form>
  );
};

const Checkout = () => {
  const { items, getTotalPrice } = useCartStore();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const subtotal = getTotalPrice();
  const hasFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shipping = items.length > 0 && !hasFreeShipping ? SHIPPING_COST : 0;
  const total = subtotal + shipping;

  // Check if Stripe is blocked
  useEffect(() => {
    if (stripePromise) {
      stripePromise.then((stripe) => {
        if (!stripe) {
          setStripeError('Stripe konnte nicht geladen werden. Bitte deaktivieren Sie Ad-Blocker oder Privacy-Erweiterungen.');
        }
      }).catch((error) => {
        if (error.message?.includes('Failed to fetch') || error.message?.includes('blocked')) {
          setStripeError('Stripe-Anfragen werden blockiert. Bitte deaktivieren Sie Ad-Blocker oder Privacy-Erweiterungen.');
        }
      });
    }
  }, []);

  useEffect(() => {
    // Create PaymentIntent on backend
    const createPaymentIntent = async () => {
      try {
        const response = await fetch(`/api/create-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: total, // Total in EUR (will be converted to cents on backend)
            currency: 'eur',
            items: items,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create payment intent');
        }
        
        const data = await response.json();
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
      } catch (error: any) {
        const isBlocked = error.name === 'TypeError' && error.message?.includes('Failed to fetch');
        if (isBlocked) {
          setStripeError('Zahlungsoptionen konnten nicht geladen werden. Bitte deaktivieren Sie Ad-Blocker oder Privacy-Erweiterungen.');
        } else {
          toast.error("Zahlungsoptionen konnten nicht geladen werden. Bitte versuche es erneut.");
          console.error("PaymentIntent error:", error);
        }
      }
    };

    if (items.length > 0 && total > 0 && !stripeError) {
      createPaymentIntent();
    }
  }, [total, items, stripeError]);

  const options: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "hsl(var(--primary))",
        colorBackground: "hsl(var(--background))",
        colorText: "hsl(var(--foreground))",
        colorDanger: "hsl(var(--destructive))",
        fontFamily: "system-ui, sans-serif",
        spacingUnit: "4px",
        borderRadius: "8px",
      },
    },
    locale: "de",
  };

  return (
    <Layout>
      <div className="container-wide py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
          <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-2">
            Kasse
          </h1>
          <p className="text-muted-foreground">
            Bitte füllen Sie die folgenden Informationen aus, um Ihre Bestellung abzuschließen
          </p>
        </motion.div>

        {stripeError ? (
          <div className="text-center py-12">
            <div className="glass-card p-8 max-w-md mx-auto border-2 border-destructive/20">
              <div className="text-destructive mb-4">
                <Lock className="w-12 h-12 mx-auto mb-2" />
                <p className="font-semibold text-lg mb-2">Stripe wurde blockiert</p>
              </div>
              <p className="text-muted-foreground mb-4">
                Stripe-Zahlungsanfragen werden blockiert. Dies kann durch folgende Ursachen verursacht werden:
              </p>
              <ul className="text-left text-sm text-muted-foreground space-y-2 mb-4">
                <li>• Ad-Blocker oder Browser-Erweiterungen blockieren Stripe</li>
                <li>• Privacy-Erweiterungen blockieren externe Anfragen</li>
                <li>• Netzwerk-Firewall blockiert Stripe-Domains</li>
              </ul>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>Lösung:</strong> Bitte deaktivieren Sie Ad-Blocker oder Privacy-Erweiterungen für diese Seite und laden Sie die Seite neu.
              </p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Seite neu laden
              </Button>
            </div>
          </div>
        ) : !stripePromise ? (
          <div className="text-center py-12">
            <div className="glass-card p-8 max-w-md mx-auto">
              <p className="text-muted-foreground mb-4">Stripe nicht konfiguriert</p>
              <p className="text-xs text-muted-foreground">
                Bitte setzen Sie VITE_STRIPE_PUBLISHABLE_KEY in Ihrer .env Datei
              </p>
            </div>
          </div>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm paymentIntentId={paymentIntentId} />
          </Elements>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm">Zahlungsoptionen werden geladen…</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Checkout;

