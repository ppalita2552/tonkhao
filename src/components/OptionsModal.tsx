/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Settings, Keyboard, Play, RotateCcw, Volume2, Shield, Flame, Palette } from 'lucide-react';
import { GameSettings, KeyBindings, MaskType } from '../types';
import { CHARACTER_PRESETS } from '../data/characters';
import { soundManager } from '../utils/audio';

interface OptionsModalProps {
  settings: GameSettings;
  onSave: (settings: GameSettings) => void;
  onClose: () => void;
}

const DEFAULT_BINDINGS: KeyBindings = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  action: 'Space',
};

export default function OptionsModal({ settings, onSave, onClose }: OptionsModalProps) {
  const [localSettings, setLocalSettings] = useState<GameSettings>({ ...settings });
  const [bindingKey, setBindingKey] = useState<keyof KeyBindings | null>(null);
  const bindingRef = useRef<HTMLDivElement>(null);

  // Focus modal container on key capture
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (bindingKey) {
        e.preventDefault();
        e.stopPropagation();
        
        let keyName = e.key;
        if (e.code === 'Space') {
          keyName = 'Space';
        }

        const updatedBindings = {
          ...localSettings.keyBindings,
          [bindingKey]: keyName,
        };

        setLocalSettings((prev) => ({
          ...prev,
          keyBindings: updatedBindings,
        }));
        
        soundManager.playKeyBind();
        setBindingKey(null);
      }
    };

    if (bindingKey) {
      window.addEventListener('keydown', handleGlobalKeyDown, true);
    }

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [bindingKey, localSettings.keyBindings]);

  const handleMaskChange = (id: MaskType) => {
    setLocalSettings((prev) => ({ ...prev, selectedMask: id }));
    soundManager.playMenuSelect();
  };

  const handleDifficultyChange = (diff: 'easy' | 'normal' | 'hard') => {
    setLocalSettings((prev) => ({ ...prev, difficulty: diff }));
    soundManager.playMenuSelect();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalSettings((prev) => ({ ...prev, soundVolume: val }));
    soundManager.setVolume(val);
  };

  // Play a small sound on volume slider release
  const handleVolumeMouseUp = () => {
    soundManager.playCollect();
  };

  const handleRestoreDefaults = () => {
    setLocalSettings((prev) => ({
      ...prev,
      keyBindings: { ...DEFAULT_BINDINGS },
      difficulty: 'normal',
      soundVolume: 0.5,
      enableParticles: true,
    }));
    soundManager.setVolume(0.5);
    soundManager.playMenuSelect();
  };

  const handleSave = () => {
    soundManager.playMenuSelect();
    onSave(localSettings);
  };

  const getReadableKeyName = (key: string) => {
    if (key === ' ') return 'Space';
    if (key === 'ArrowUp') return '▲ ขึ้น';
    if (key === 'ArrowDown') return '▼ ลง';
    if (key === 'ArrowLeft') return '◀ ซ้าย';
    if (key === 'ArrowRight') return '▶ ขวา';
    return key;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative bg-neutral-900 border border-amber-600/30 rounded-2xl p-6 w-full max-w-2xl text-white shadow-2xl shadow-amber-900/10 my-8"
        id="options-modal-container"
      >
        {/* Modal Title */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
            <h2 className="text-2xl font-bold font-kanit tracking-wide text-amber-500">
              การตั้งค่าเกม (Game Options)
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition bg-neutral-800 hover:bg-neutral-700 w-8 h-8 rounded-full flex items-center justify-center font-bold"
            id="close-options-button"
          >
            ✕
          </button>
        </div>

        {/* Modal Content - Scrollable if needed */}
        <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Section 1: Choose Mask */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-amber-500/80 uppercase mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" /> เลือกสวมหน้ากากผีตาโขน (Select Character Mask)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CHARACTER_PRESETS.map((preset) => {
                const isSelected = localSettings.selectedMask === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleMaskChange(preset.id)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all relative overflow-hidden ${
                      isSelected 
                        ? 'bg-amber-950/20 border-amber-500 shadow-lg shadow-amber-500/10' 
                        : 'bg-neutral-950/40 border-neutral-800 hover:border-neutral-700'
                    }`}
                    id={`mask-select-${preset.id}`}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      {/* Bouncing Visual Mask representation */}
                      <span 
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ 
                          background: `radial-gradient(circle, ${preset.color} 0%, ${preset.secondaryColor} 100%)`,
                          boxShadow: isSelected ? `0 0 10px ${preset.color}` : 'none'
                        }}
                      >
                        🎭
                      </span>
                      <span className="font-bold text-sm text-neutral-100">{preset.name}</span>
                      {isSelected && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full ml-auto font-medium">
                          ใช้งานอยู่
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 pl-7">
                      {preset.description}
                    </p>
                    <div className="mt-2 text-[11px] text-amber-500/70 pl-7 font-mono">
                      ตัวคูณความเร็ว: {preset.speedMultiplier}x
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Key Bindings */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-amber-500/80 uppercase mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4" /> ปรับค่าปุ่มบังคับตัวละคร (Customize Controls)
            </h3>
            <p className="text-xs text-neutral-400 mb-4">
              คลิกที่ช่องปุ่มที่คุณต้องการเปลี่ยน แล้วกดปุ่มใหม่บนแป้นพิมพ์เพื่อตั้งค่า
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800">
              
              {/* Up/Jump */}
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900/60 border border-neutral-800/40">
                <span className="text-sm font-medium text-neutral-300">กระโดด (Jump / Up)</span>
                <button
                  onClick={() => setBindingKey('up')}
                  className={`px-3 py-1.5 text-xs font-mono rounded min-w-[100px] border transition-all ${
                    bindingKey === 'up'
                      ? 'bg-amber-500 text-black border-amber-400 animate-pulse font-bold'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-amber-400 border-neutral-800'
                  }`}
                  id="bind-up-button"
                >
                  {bindingKey === 'up' ? 'รอปุ่ม...' : getReadableKeyName(localSettings.keyBindings.up)}
                </button>
              </div>

              {/* Down/Slide */}
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900/60 border border-neutral-800/40">
                <span className="text-sm font-medium text-neutral-300">สไลด์ตัว (Slide / Down)</span>
                <button
                  onClick={() => setBindingKey('down')}
                  className={`px-3 py-1.5 text-xs font-mono rounded min-w-[100px] border transition-all ${
                    bindingKey === 'down'
                      ? 'bg-amber-500 text-black border-amber-400 animate-pulse font-bold'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-amber-400 border-neutral-800'
                  }`}
                  id="bind-down-button"
                >
                  {bindingKey === 'down' ? 'รอปุ่ม...' : getReadableKeyName(localSettings.keyBindings.down)}
                </button>
              </div>

              {/* Left/Move Left */}
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900/60 border border-neutral-800/40">
                <span className="text-sm font-medium text-neutral-300">วิ่งซ้าย (Move Left)</span>
                <button
                  onClick={() => setBindingKey('left')}
                  className={`px-3 py-1.5 text-xs font-mono rounded min-w-[100px] border transition-all ${
                    bindingKey === 'left'
                      ? 'bg-amber-500 text-black border-amber-400 animate-pulse font-bold'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-amber-400 border-neutral-800'
                  }`}
                  id="bind-left-button"
                >
                  {bindingKey === 'left' ? 'รอปุ่ม...' : getReadableKeyName(localSettings.keyBindings.left)}
                </button>
              </div>

              {/* Right/Move Right */}
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900/60 border border-neutral-800/40">
                <span className="text-sm font-medium text-neutral-300">วิ่งขวา (Move Right)</span>
                <button
                  onClick={() => setBindingKey('right')}
                  className={`px-3 py-1.5 text-xs font-mono rounded min-w-[100px] border transition-all ${
                    bindingKey === 'right'
                      ? 'bg-amber-500 text-black border-amber-400 animate-pulse font-bold'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-amber-400 border-neutral-800'
                  }`}
                  id="bind-right-button"
                >
                  {bindingKey === 'right' ? 'รอปุ่ม...' : getReadableKeyName(localSettings.keyBindings.right)}
                </button>
              </div>

              {/* Action/Interact */}
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900/60 border border-neutral-800/40 sm:col-span-2">
                <span className="text-sm font-medium text-neutral-300">เปิดใช้พลังน้ำมนต์ (Activate Shield)</span>
                <button
                  onClick={() => setBindingKey('action')}
                  className={`px-3 py-1.5 text-xs font-mono rounded min-w-[120px] border transition-all ${
                    bindingKey === 'action'
                      ? 'bg-amber-500 text-black border-amber-400 animate-pulse font-bold'
                      : 'bg-neutral-950 hover:bg-neutral-800 text-amber-400 border-neutral-800'
                  }`}
                  id="bind-action-button"
                >
                  {bindingKey === 'action' ? 'รอปุ่ม...' : getReadableKeyName(localSettings.keyBindings.action)}
                </button>
              </div>

            </div>
          </div>

          {/* Section 3: Game Difficulty & Volume */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Difficulty Setting */}
            <div className="bg-neutral-950/40 border border-neutral-800 p-4 rounded-xl">
              <h3 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-red-500" /> ระดับความยาก (Difficulty)
              </h3>
              <div className="flex bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                {(['easy', 'normal', 'hard'] as const).map((diff) => {
                  const label = diff === 'easy' ? 'ง่าย' : diff === 'normal' ? 'ปานกลาง' : 'ท้าทาย';
                  const activeColor = diff === 'easy' ? 'bg-green-600 text-white' : diff === 'normal' ? 'bg-amber-500 text-black' : 'bg-red-600 text-white';
                  const isActive = localSettings.difficulty === diff;
                  return (
                    <button
                      key={diff}
                      onClick={() => handleDifficultyChange(diff)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        isActive ? activeColor : 'text-neutral-400 hover:text-white'
                      }`}
                      id={`diff-btn-${diff}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Volume Setting */}
            <div className="bg-neutral-950/40 border border-neutral-800 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-sky-400" /> เสียงประกอบ (Sound Effects)
                </h3>
                <span className="text-xs text-sky-400 font-mono font-bold">
                  {Math.round(localSettings.soundVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localSettings.soundVolume}
                onChange={handleVolumeChange}
                onMouseUp={handleVolumeMouseUp}
                onTouchEnd={handleVolumeMouseUp}
                className="w-full accent-amber-500 bg-neutral-800 h-2 rounded-lg cursor-pointer appearance-none"
                id="sound-volume-slider"
              />
            </div>
          </div>

          {/* Section 4: Particle effects */}
          <div className="flex items-center justify-between bg-neutral-950/40 border border-neutral-800 p-4 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-neutral-300">เอฟเฟกต์อนุภาคเรืองแสง (Visual Particles)</span>
              <span className="text-xs text-neutral-400">ปิดเพื่อความเสถียรและความลื่นไหลของตัวเกมบนอุปกรณ์เก่า</span>
            </div>
            <button
              onClick={() => {
                setLocalSettings(prev => ({ ...prev, enableParticles: !prev.enableParticles }));
                soundManager.playMenuSelect();
              }}
              className={`w-14 h-7 rounded-full transition-all relative p-1 ${
                localSettings.enableParticles ? 'bg-amber-500' : 'bg-neutral-800'
              }`}
              id="toggle-particles-button"
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                localSettings.enableParticles ? 'translate-x-7' : 'translate-x-0'
              }`} />
            </button>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 items-center justify-between border-t border-neutral-800 pt-5 mt-6">
          <button
            onClick={handleRestoreDefaults}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-950 hover:bg-neutral-800 rounded-xl border border-neutral-800 transition"
            id="restore-defaults-button"
          >
            <RotateCcw className="w-3.5 h-3.5" /> คืนค่าเริ่มต้น (Defaults)
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition"
              id="cancel-options-button"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition shadow-lg shadow-amber-500/20"
              id="save-options-button"
            >
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
