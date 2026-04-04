import { useId } from "react";

const FadingCircle = ({ size = 200, color = "red" }) => {
    const gradientId = useId();
    
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 200 200" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.2 }} />
            <stop offset="50%" style={{ stopColor: color, stopOpacity: 0.1 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="80" fill={`url(#${gradientId})`} />
      </svg>
    );
  };
  
  export default FadingCircle;