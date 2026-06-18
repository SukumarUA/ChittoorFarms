import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, MessageCircle, ShoppingBag, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';

export const CartDrawer: React.FC = () => {
  const {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeFromCart,
    cartTotal,
    clearCart,
  } = useCart();

  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waNumber, setWaNumber] = useState('');
  const [orderConfirmation, setOrderConfirmation] = useState<{
    reference: string;
    whatsappUrl: string;
  } | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountInfo, setDiscountInfo] = useState<{
    referral_valid: boolean; referral_pct: number; referral_msg: string;
    promo_valid: boolean; promo_pct: number; promo_msg: string;
    total_discount_pct: number;
  } | null>(null);
  const [isValidatingCodes, setIsValidatingCodes] = useState(false);

  // Date limit: today or later
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const loadWhatsAppNumber = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('wa_number')
        .eq('id', 'main')
        .single();

      if (error) {
        console.error('Could not load WhatsApp number:', error);
        return;
      }

      setWaNumber(data?.wa_number || '');
    };

    void loadWhatsAppNumber();
  }, []);

  const handleCloseDrawer = () => {
    setIsCartOpen(false);
  };

  const handleOpenCheckout = () => {
    setIsCheckoutOpen(true);
  };

  const handleCloseCheckout = () => {
    setIsCheckoutOpen(false);
  };

  const validateCodes = async (refCode: string, pCode: string, phoneVal: string) => {
    if (!refCode && !pCode) { setDiscountInfo(null); return; }
    const phoneDigits = phoneVal.replace(/\D/g, '');
    setIsValidatingCodes(true);
    try {
      const { data, error } = await supabase.rpc('validate_discount_codes', {
        p_referral_code: refCode || null,
        p_promo_code: pCode || null,
        p_phone: phoneDigits || null,
      });
      if (!error && data) setDiscountInfo(data as typeof discountInfo);
    } catch { /* silent */ } finally {
      setIsValidatingCodes(false);
    }
  };

  const formatOrderUnit = (unit: string) => unit.trim().replace(/^1(?=\s*[a-zA-Z])\s*/, '');

  const handleOpenWhatsApp = () => {
    if (!orderConfirmation?.whatsappUrl) return;
    const whatsappTab = window.open(orderConfirmation.whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!whatsappTab) window.location.assign(orderConfirmation.whatsappUrl);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!fullName.trim()) {
      showToast('Please enter your full name.', 'error');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    if (!address.trim()) {
      showToast('Please enter your delivery address.', 'error');
      return;
    }

    if (pinCode && !/^\d{6}$/.test(pinCode)) {
      showToast('PIN code must be a 6-digit number.', 'error');
      return;
    }

    const totalKg = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    if (totalKg < 5) {
      showToast(`Minimum order is 5kg. Your cart has ${totalKg}kg — please add more items.`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItems = cartItems.map((item) => ({
        product_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
      }));

      // Supabase atomically assigns the daily YYYYMMDDCF00001 order number.
      const discountPct = discountInfo?.total_discount_pct ?? 0;
      const discountAmount = Math.round(cartTotal * discountPct) / 100;
      const finalTotal = cartTotal - discountAmount;

      const { data: orderReference, error } = await supabase.rpc('create_order', {
        p_customer_name: fullName.trim(),
        p_phone: phoneDigits,
        p_address: address.trim(),
        p_pin_code: pinCode || '',
        p_preferred_delivery_date: preferredDate || null,
        p_special_instructions: instructions.trim(),
        p_items: orderItems,
        p_total: finalTotal,
        p_referral_code: referralCode.trim() || null,
        p_promo_code: promoCode.trim() || null,
      });

      if (error) throw error;
      if (!orderReference) throw new Error('The order reference was not generated.');

      // Stock is now decremented atomically inside create_order on the server.
      // No client-side stock update needed.

      if (waNumber) {
        const itemLines = orderItems.flatMap((item) => {
          const unit = formatOrderUnit(item.unit);
          return [
            `- ${item.name}`,
            `  Quantity: ${item.quantity} ${unit}`,
            `  Price: ₹${item.price} per ${unit}`,
            `  Amount: ₹${item.quantity * item.price}`,
          ];
        });
        const discountPct2 = discountInfo?.total_discount_pct ?? 0;
        const discountAmt2 = Math.round(cartTotal * discountPct2) / 100;
        const finalTotal2 = cartTotal - discountAmt2;
        const discountLine = discountPct2 > 0 ? [`Discount: ${discountPct2}% (-₹${discountAmt2})`, `*Total: ₹${finalTotal2}*`] : [`*Total: ₹${cartTotal}*`];
        const whatsappMessage = [
          '*New Chittoor Farms Order*',
          `Order Ref: ${orderReference}`,
          '',
          `Customer: ${fullName.trim()}`,
          `Phone: ${phoneDigits}`,
          `Address: ${address.trim()}${pinCode ? ` - ${pinCode}` : ''}`,
          `Preferred delivery: ${preferredDate || 'No preference'}`,
          '',
          '*Items*',
          ...itemLines,
          '',
          ...discountLine,
          `Payment: COD / UPI`,
          `Instructions: ${instructions.trim() || 'None'}`,
        ].join('\n');
        const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}`;
        setOrderConfirmation({ reference: String(orderReference), whatsappUrl });
      } else {
        showToast("Order placed! We'll contact you shortly.", 'success');
      }

      clearCart();
      setIsCheckoutOpen(false);
      setIsCartOpen(false);

      // Reset form
      setFullName('');
      setPhone('');
      setAddress('');
      setPinCode('');
      setPreferredDate('');
      setInstructions('');
      setReferralCode('');
      setPromoCode('');
      setDiscountInfo(null);
    } catch (err: unknown) {
      console.error('Checkout error:', err);
      showToast('Failed to place order. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Drawer Overlay */}
      <div className={`cart-drawer-backdrop ${isCartOpen ? 'open' : ''}`} onClick={handleCloseDrawer}>
        <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="cart-drawer-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag size={20} />
              <span>Shopping Cart</span>
            </h3>
            <button className="btn-icon" onClick={handleCloseDrawer} aria-label="Close Cart">
              <X size={20} />
            </button>
          </div>

          <div className="cart-drawer-body">
            {cartItems.length === 0 ? (
              <div className="cart-empty">
                <ShoppingBag className="cart-empty-icon" />
                <p>Your cart is empty.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => { handleCloseDrawer(); navigate('/shop'); }}
                >
                  Shop
                </button>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.id} className="cart-item">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="cart-item-img"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1553135933-0d13db7f0ece?auto=format&fit=crop&q=80&w=200';
                    }}
                  />
                  <div className="cart-item-details">
                    <div>
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-price">
                        ₹{item.price} / {item.unit}
                      </div>
                    </div>
                    <div className="cart-item-qty">
                      <button
                        className="qty-btn"
                        onClick={() => updateQuantity(item.id, item.quantity - 1, item.stock)}
                      >
                        -
                      </button>
                      <span className="qty-val">{item.quantity}</span>
                      <button
                        className="qty-btn"
                        disabled={item.quantity >= item.stock}
                        onClick={() => updateQuantity(item.id, item.quantity + 1, item.stock)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>₹{item.price * item.quantity}</span>
                    <button
                      className="cart-item-remove"
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {cartItems.length > 0 && (
            <div className="cart-drawer-footer">
              <div className="cart-total-row">
                <span>Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>
              {cartItems.reduce((sum, item) => sum + item.quantity, 0) < 5 && (
                <div style={{ fontSize: '0.82rem', color: 'var(--error, #c0392b)', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.7rem', marginBottom: '0.5rem' }}>
                  Minimum order is 5kg — add {5 - cartItems.reduce((sum, item) => sum + item.quantity, 0)}kg more to proceed
                </div>
              )}
              <button className="btn btn-secondary cart-checkout-btn" onClick={handleOpenCheckout}>
                <span>Proceed to checkout</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      <div className={`modal-backdrop ${isCheckoutOpen ? 'open' : ''}`} onClick={handleCloseCheckout}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Delivery Details</h3>
            <button className="btn-icon" onClick={handleCloseCheckout} aria-label="Close Checkout">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCheckoutSubmit}>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="fullName">Full Name *</label>
                <input
                  type="text"
                  id="fullName"
                  className="form-control"
                  placeholder="e.g. Sukumar C"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number (10-digit mobile) *</label>
                <input
                  type="tel"
                  id="phone"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">Delivery Address *</label>
                <textarea
                  id="address"
                  className="form-control"
                  placeholder="Street, area, landmark, city"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pinCode">PIN Code (6-digit)</label>
                  <input
                    type="text"
                    id="pinCode"
                    className="form-control"
                    placeholder="e.g. 517001"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="preferredDate">Preferred Delivery Date</label>
                  <input
                    type="date"
                    id="preferredDate"
                    className="form-control"
                    min={todayStr}
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="instructions">Special Instructions</label>
                <input
                  type="text"
                  id="instructions"
                  className="form-control"
                  placeholder="e.g. deliver in morning, ripe mangoes please"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="referralCode" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Referral Code
                    <span className="referral-code-info" title="Have a referral code from a friend? Enter it here to get 10% off your order.">ⓘ</span>
                  </label>
                  <input
                    type="text"
                    id="referralCode"
                    className="form-control"
                    placeholder="e.g. FRIEND10"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    onBlur={() => validateCodes(referralCode, promoCode, phone)}
                  />
                  {referralCode && discountInfo && (
                    <small style={{ color: discountInfo.referral_valid ? 'var(--primary)' : '#c0392b', marginTop: '0.25rem', display: 'block' }}>
                      {discountInfo.referral_msg}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="promoCode" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Promo Code
                    <span className="referral-code-info" title="Reordering with the same phone number? Enter REORDER for an extra 5% off!">ⓘ</span>
                  </label>
                  <input
                    type="text"
                    id="promoCode"
                    className="form-control"
                    placeholder="e.g. REORDER"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    onBlur={() => validateCodes(referralCode, promoCode, phone)}
                  />
                  {promoCode && discountInfo && (
                    <small style={{ color: discountInfo.promo_valid ? 'var(--primary)' : '#c0392b', marginTop: '0.25rem', display: 'block' }}>
                      {discountInfo.promo_msg}
                    </small>
                  )}
                </div>
              </div>

              {discountInfo && discountInfo.total_discount_pct > 0 && (
                <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.85rem', background: 'rgba(var(--primary-rgb, 34,139,34), 0.08)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  🎉 <strong>{discountInfo.total_discount_pct}% discount applied!</strong>
                  {' '}You save ₹{Math.round(cartTotal * discountInfo.total_discount_pct) / 100} — final total{' '}
                  <strong>₹{cartTotal - Math.round(cartTotal * discountInfo.total_discount_pct) / 100}</strong>
                  {isValidatingCodes && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>checking…</span>}
                </div>
              )}

              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                ℹ️ <strong>Payment Notice:</strong> No upfront payment is required. Payment is collected via UPI or Cash on delivery.
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={handleCloseCheckout} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-secondary" disabled={isSubmitting}>
                {isSubmitting ? 'Placing Order...' : 'Place Order (COD/UPI)'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Order Success and WhatsApp Reminder */}
      <div className={`modal-backdrop ${orderConfirmation ? 'open' : ''}`}>
        <div className="modal-content order-success-modal" onClick={(event) => event.stopPropagation()}>
          <img className="order-success-logo" src="/CTRFLOGO.jpeg" alt="Chittoor Farms" />
          <div className="order-success-icon">
            <CheckCircle2 size={42} />
          </div>
          <h3>Order Placed Successfully</h3>
          <p>
            Your order <strong>#{orderConfirmation?.reference}</strong> has been saved with Chittoor Farms.
          </p>
          <div className="whatsapp-reminder">
            <MessageCircle size={24} />
            <div>
              <strong>One final step</strong>
              <span>Open WhatsApp and tap Send on the prepared message so our team receives your order details.</span>
            </div>
          </div>
          <button type="button" className="btn btn-whatsapp order-whatsapp-button" onClick={handleOpenWhatsApp}>
            <MessageCircle size={19} /> Send Order on WhatsApp
          </button>
          <button type="button" className="order-success-close" onClick={() => setOrderConfirmation(null)}>
            I will send it later
          </button>
        </div>
      </div>
    </>
  );
};
