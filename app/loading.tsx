'use client';

import { motion } from 'framer-motion';

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
      <div className="relative flex flex-col items-center">
        <motion.div
          className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-teal-400 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* スケルトンローダーの代わりにパルスアニメーションの円 */}
        <div className="absolute">
          <motion.div
            className="w-16 h-16 rounded-full bg-blue-400/20"
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.3, 0.1, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>
        
        <motion.p
          className="mt-4 text-gray-700 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          読み込み中...
        </motion.p>
      </div>
    </div>
  );
} 