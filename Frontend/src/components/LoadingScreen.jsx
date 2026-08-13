import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadingScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 text-white"
          style={{
            background: '#111827',
            fontFamily: "'Inter', sans-serif"
          }}
        >
          {/* Stylized Logo/Crest Animation */}
          <div className="relative flex flex-col items-center">
            {/* Animated brick elements */}
            <div className="flex gap-1.5 mb-2">
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{ width: '28px', height: '14px', background: '#007aff', borderRadius: '3px' }}
              />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
                style={{ width: '28px', height: '14px', background: '#007aff', borderRadius: '3px' }}
              />
            </div>
            <div className="flex gap-1.5 mb-6 justify-center" style={{ marginLeft: '-15px' }}>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
                style={{ width: '28px', height: '14px', background: '#0055b3', borderRadius: '3px' }}
              />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.5, ease: 'easeOut' }}
                style={{ width: '28px', height: '14px', background: '#007aff', borderRadius: '3px' }}
              />
            </div>

            {/* Sub-tagline */}
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.5, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: '#9ca3af',
                marginBottom: '8px'
              }}
            >
              Enterprise ERP
            </motion.span>

            {/* Main Brand Title */}
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              style={{
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.5px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🧱 Sai Varun Enterprise
            </motion.h2>

            {/* Elegant Line Accent */}
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 120, opacity: 1 }}
              transition={{ delay: 1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '1px',
                background: 'linear-gradient(90deg, transparent, #007aff, transparent)',
                marginTop: '16px'
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
