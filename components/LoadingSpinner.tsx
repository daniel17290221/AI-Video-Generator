
import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, className }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary"></div> {/* Changed to primary color */}
      {message && <p className="mt-4 text-lg text-center">{message}</p>} {/* Removed hardcoded text color */}
    </div>
  );
};

export default LoadingSpinner;
