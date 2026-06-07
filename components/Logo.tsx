
import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <svg 
            viewBox="0 0 100 100" 
            className={className} 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="4" />
            <path 
                d="M30 30L70 70M70 30L30 70" 
                stroke="currentColor" 
                strokeWidth="8" 
                strokeLinecap="round" 
            />
            <circle cx="50" cy="50" r="15" fill="currentColor" />
        </svg>
    );
};
