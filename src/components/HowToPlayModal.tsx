/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, MapPin, Sparkles, Award } from 'lucide-react';
import { HOW_TO_PLAY_STEPS, DAN_SAI_LORE } from '../data/howToPlay';
import { soundManager } from '../utils/audio';

interface HowToPlayModalProps {
  onClose: () => void;
}

export default function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  const handleClose = () => {
    soundManager.playMenuSelect();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-neutral-900 border border-amber-600/30 rounded-2xl p-6 w-full max-w-2xl text-white shadow-2xl shadow-amber-900/10 my-8"
        id="how-to-play-modal-container"
      >
        {/* Modal Title */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-500 animate-pulse" />
            <h2 className="text-2xl font-bold font-kanit tracking-wide text-amber-500">
              วิธีการเล่น & วัฒนธรรมด่านซ้าย
            </h2>
          </div>
          <button 
            onClick={handleClose}
            className="text-neutral-400 hover:text-white transition bg-neutral-800 hover:bg-neutral-700 w-8 h-8 rounded-full flex items-center justify-center font-bold"
            id="close-how-to-play-button"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Section 1: Backstory / Culture */}
          <div className="bg-neutral-950/60 border border-amber-600/10 rounded-xl p-4 flex gap-4 items-start">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 mt-1">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-400 mb-1 font-kanit">
                เทศกาลผีตาโขน ด่านซ้าย จ.เลย
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                {DAN_SAI_LORE}
              </p>
            </div>
          </div>

          {/* Section 2: Instructions Steps */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-amber-500/80 uppercase mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> ขั้นตอนการผจญภัย
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HOW_TO_PLAY_STEPS.map((step, index) => (
                <div 
                  key={index} 
                  className="bg-neutral-950/40 border border-neutral-800/60 hover:border-neutral-700 p-4 rounded-xl flex gap-3 transition-colors"
                >
                  <span className="text-3xl shrink-0 select-none">{step.icon}</span>
                  <div>
                    <h4 className="text-sm font-bold text-white font-kanit mb-1">
                      {index + 1}. {step.title}
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Points breakdown */}
          <div className="bg-neutral-950/30 border border-neutral-800/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold tracking-wider text-amber-500/80 uppercase mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" /> ตารางไอเทมศักดิ์สิทธิ์
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 flex items-center gap-2">
                <span className="text-2xl select-none">🍙</span>
                <div>
                  <div className="font-bold text-neutral-200">กระติบข้าวเหนียว</div>
                  <div className="text-amber-500 font-bold font-mono">+10 คะแนน</div>
                </div>
              </div>
              <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 flex items-center gap-2">
                <span className="text-2xl select-none">🧴</span>
                <div>
                  <div className="font-bold text-neutral-200">น้ำมนต์ศักดิ์สิทธิ์</div>
                  <div className="text-sky-400 font-bold">+บาเรียป้องกันการชน</div>
                </div>
              </div>
              <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 flex items-center gap-2">
                <span className="text-2xl select-none">🌸</span>
                <div>
                  <div className="font-bold text-neutral-200">ดอกไม้ผาสาด</div>
                  <div className="text-green-400 font-bold font-mono">+50 คะแนน</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex justify-end border-t border-neutral-800 pt-5 mt-6">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition text-sm"
            id="confirm-how-to-play"
          >
            เข้าใจแล้ว เริ่มผจญภัย!
          </button>
        </div>
      </motion.div>
    </div>
  );
}
