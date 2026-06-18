import React from 'react';
import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <Sprout size={56} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.6 }} />
      <h1 style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1, marginBottom: '0.5rem' }}>404</h1>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '0.75rem' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '360px' }}>
        This page doesn't exist or may have been moved.
      </p>
      <Link to="/" className="btn btn-secondary">Back to Home</Link>
    </div>
  );
};
