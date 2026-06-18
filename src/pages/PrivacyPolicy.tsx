import React, { useEffect } from 'react';

export const PrivacyPolicy: React.FC = () => {
  useEffect(() => {
    document.title = 'Privacy Policy | Chittoor Farms';
    return () => { document.title = 'Chittoor Farms — Fresh from Farm to Home'; };
  }, []);

  return (
    <div className="container" style={{ maxWidth: 760, padding: '3rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Last updated: June 2026
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>1. Information We Collect</h2>
        <p>When you place an order or book a farm visit, we collect your name, phone number, delivery address, and order details. We do not collect payment card details — payments are handled externally via UPI/bank transfer.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>2. How We Use Your Information</h2>
        <p>We use your information solely to fulfil your order, communicate about delivery, and send WhatsApp updates related to your purchase. We do not sell or share your data with third parties for marketing.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>3. Data Storage</h2>
        <p>Your data is stored securely on Supabase servers hosted in the Asia-Pacific (Mumbai) region. We use row-level security policies to ensure your data is accessible only to authorised personnel.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>4. Your Rights (DPDP Act 2023)</h2>
        <p>Under India's Digital Personal Data Protection Act 2023, you have the right to access, correct, or request deletion of your personal data. To exercise these rights, contact us at <a href="mailto:contact@chittoorfarms.in">contact@chittoorfarms.in</a>.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>5. Cookies</h2>
        <p>We use only essential browser storage (localStorage) to maintain your shopping cart session. No tracking cookies or advertising pixels are used.</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>6. Contact</h2>
        <p>For any privacy-related queries, reach us at <a href="mailto:contact@chittoorfarms.in">contact@chittoorfarms.in</a> or via WhatsApp at +91 93900 33516.</p>
      </section>
    </div>
  );
};
