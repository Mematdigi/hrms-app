// src/components/common/BackButton.jsx
// Usage: import BackButton from 'components/common/BackButton';
//        Then place <BackButton /> at the top of any page component.

import React from 'react';
import { useNavigate } from 'react-router-dom';

const BackButton = ({ label = 'Back', to = null, className = '' }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);          // go to a specific route
    } else {
      navigate(-1);          // go to the previous page in history
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`back-btn ${className}`}
      aria-label="Go back"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{label}</span>
    </button>
  );
};

export default BackButton;