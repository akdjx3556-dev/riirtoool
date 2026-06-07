
import React from 'react';

export const Loader: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
    </div>
  );
};
