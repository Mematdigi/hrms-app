// src/pages/MobileBlock.js

import React from 'react';

const MobileBlock = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      textAlign: 'center',
      padding: '20px',
      backgroundColor: '#f8f9fa'
    }}>
      <span style={{ fontSize: '64px' }}>🚫</span>
      <h2 style={{ color: '#dc3545', fontSize: '24px', marginTop: '16px' }}>
        Mobile Not Supported
      </h2>
      <p style={{ color: '#6c757d', maxWidth: '400px', marginTop: '8px', lineHeight: '1.6' }}>
        This application is currently not working. <strong>Contact with dev Team</strong> for assistance.
      </p>
    </div>
  );
};

export default MobileBlock;