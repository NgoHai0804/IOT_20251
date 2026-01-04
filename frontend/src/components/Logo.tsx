import { useState } from 'react';
import { motion } from 'motion/react';
import { Home } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const subtextSizeClasses = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <motion.div
      className={`flex items-center gap-3 ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`${sizeClasses[size]} bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30 relative overflow-hidden`}>
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 animate-pulse" />
        
        {/* Logo image or icon fallback */}
        <div className="relative z-10 flex items-center justify-center w-full h-full">
          {!imageError ? (
            <img 
              src="/S22.png" 
              alt="Smart Home Logo" 
              className="w-full h-full object-contain p-1"
              onError={() => setImageError(true)}
            />
          ) : (
            <Home className={`${iconSizes[size]} text-white`} />
          )}
        </div>
      </div>
      {showText && (
        <div>
          <h1 className={`text-white font-bold ${textSizeClasses[size]}`}>
            Smart Home
          </h1>
          <p className={`text-cyan-200/70 font-medium ${subtextSizeClasses[size]}`}>
            {size === 'lg' ? 'Management System' : 'Control Center'}
          </p>
        </div>
      )}
    </motion.div>
  );
}

