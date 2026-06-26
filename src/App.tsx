/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Settings, BookOpen, Volume2, Award, Calendar, Share2, HelpCircle } from 'lucide-react';
import { GameSettings, MaskType } from './types';
import { CHARACTER_PRESETS } from './data/characters';
import { soundManager } from './utils/audio';

// Components
import OptionsModal from './components/OptionsModal';
import HowToPlayModal from './components/HowToPlayModal';
import GameScreen from './components/GameScreen';

const STORAGE_KEYS = {
  SETTINGS: 'dan-sai-adventure-settings',
  HIGH_SCORE: 'dan-sai-adventure-highscore',
};

const DEFAULT_SETTINGS: GameSettings = {
  keyBindings: {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    action: 'Space',
  },
  selectedMask: 'classic-red',
  difficulty: 'normal',
  soundVolume: 0.5,
  enableParticles: true,
};

export default function App() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  
  // Game Configuration loaded from localStorage
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [highScore, setHighScore] = useState<number>(0);

  // Background floating embers particles
  const [menuParticles, setMenuParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; duration: number }>>([]);

  // Load from LocalStorage on Mount
  useEffect(() => {
    // Load Settings
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        soundManager.setVolume(parsed.soundVolume);
      } catch (e) {
        console.warn('Failed to parse settings, using defaults');
      }
    } else {
      soundManager.setVolume(DEFAULT_SETTINGS.soundVolume);
    }

    // Load High Score
    const savedHighScore = localStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }

    // Initialize decorative menu particles
    const particles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 10 + 10,
    }));
    setMenuParticles(particles);
  }, []);

  const saveSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    soundManager.setVolume(newSettings.soundVolume);
    setShowOptions(false);
  };

  const updateHighScore = (score: number) => {
    setHighScore(score);
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, score.toString());
  };

  const handleStartGame = () => {
    soundManager.playMenuSelect();
    setIsPlaying(true);
  };

  const handleOpenOptions = () => {
    soundManager.playMenuSelect();
    setShowOptions(true);
  };

  const handleOpenHowToPlay = () => {
    soundManager.playMenuSelect();
    setShowHowToPlay(true);
  };

  const activePreset = CHARACTER_PRESETS.find(p => p.id === settings.selectedMask) || CHARACTER_PRESETS[0];

  if (isPlaying) {
    return (
      <GameScreen
        settings={settings}
        onBackToMenu={() => {
          soundManager.playMenuSelect();
          setIsPlaying(false);
        }}
        highScore={highScore}
        onNewHighScore={updateHighScore}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-between p-6 select-none font-sans overflow-hidden" id="app-root-container">
      
      {/* Decorative Night Glowing Embers/Particles in Background */}
      {settings.enableParticles && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {menuParticles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.id % 2 === 0 ? '#ef4444' : '#eab308', // Red and Gold traditional embers
                boxShadow: `0 0 10px ${p.id % 2 === 0 ? '#ef4444' : '#eab308'}`,
              }}
              animate={{
                y: [0, -150, -300],
                x: [0, Math.sin(p.id) * 30, Math.sin(p.id) * -30],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Decorative Traditional Red Ribbon Header Line */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 z-10" />

      {/* Header section (Cultural / Location Info) */}
      <header className="w-full max-w-4xl flex justify-between items-center z-10 mt-2">
        <div className="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-900/60 border border-neutral-800 px-3 py-1.5 rounded-full backdrop-blur-sm">
          <Calendar className="w-3.5 h-3.5 text-red-500" />
          <span className="font-medium font-kanit">ประเพณีบุญหลวงและการละเล่นผีตาโขน อ.ด่านซ้าย จ.เลย</span>
        </div>

        {/* Top Right High Score Badge */}
        {highScore > 0 && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-full backdrop-blur-sm text-amber-400 text-xs font-mono font-bold">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>HIGH SCORE: {highScore}</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="w-full max-w-lg flex flex-col items-center justify-center z-10 my-auto text-center">
        
        {/* Game Logo with gentle floating breathe animation */}
        <motion.div
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="mb-4 relative group"
          id="game-logo-wrapper"
        >
          {/* Subtle glowing halo behind logo */}
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-red-600 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition duration-1000" />
          
          <img
            src="https://res.cloudinary.com/dsucg33fv/image/upload/v1782439979/logo_fj2ctz.png"
            alt="Dan Sai Adventure Logo"
            className="w-56 h-auto mx-auto relative z-10 filter drop-shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            referrerPolicy="no-referrer"
            id="game-logo-img"
          />
        </motion.div>

        {/* Title configured to use Kanit Google Font as requested */}
        <h1 
          className="text-4xl sm:text-5xl font-black font-kanit tracking-wide mb-2 text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-amber-500 to-red-600 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
          id="game-title"
        >
          Dan Sai Adventure
        </h1>
        
        <p className="text-sm font-kanit font-medium text-neutral-300 max-w-sm mb-10 leading-relaxed">
          ผจญภัยในโลกแห่งสีสันและวิญญาณแห่งเทศกาลผีตาโขน หลบสิ่งกีดขวาง สะสมบุญ และเดินทางมุ่งสู่วัดโพนชัยด่านซ้าย!
        </p>

        {/* Main Game Menu Options as requested */}
        <div className="w-full flex flex-col gap-4 max-w-xs mb-8" id="main-menu-options">
          
          {/* Menu Option 1: Start Adventure */}
          <button
            onClick={handleStartGame}
            className="group relative flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-extrabold font-kanit text-lg rounded-2xl hover:from-amber-400 hover:to-yellow-400 shadow-xl shadow-amber-500/20 active:scale-95 transition-all duration-150 cursor-pointer"
            id="menu-start-adventure-button"
          >
            {/* Pulsing visual outline indicator */}
            <div className="absolute -inset-[3px] border border-yellow-300/60 rounded-2xl group-hover:scale-[1.02] transition" />
            
            <Play className="w-5 h-5 fill-black group-hover:scale-110 transition" />
            <span>เริ่มเล่นเกม (PLAY GAME)</span>
          </button>

          {/* Menu Option 2: Settings / Options */}
          <button
            onClick={handleOpenOptions}
            className="flex items-center justify-center gap-3 w-full py-3.5 bg-neutral-900 hover:bg-neutral-850 border border-amber-600/20 hover:border-amber-500/60 rounded-2xl text-amber-500 font-bold font-kanit text-base active:scale-95 transition-all duration-150 cursor-pointer"
            id="menu-options-button"
          >
            <Settings className="w-5 h-5 text-amber-500 group-hover:rotate-45 transition" />
            <span>การตั้งค่าปุ่ม & ตัวละคร (OPTIONS)</span>
          </button>

          {/* Menu Option 3: How to Play */}
          <button
            onClick={handleOpenHowToPlay}
            className="flex items-center justify-center gap-3 w-full py-3 bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl text-neutral-300 font-medium font-kanit text-sm active:scale-95 transition-all duration-150 cursor-pointer"
            id="menu-how-to-play-button"
          >
            <BookOpen className="w-4 h-4 text-neutral-400" />
            <span>วิธีการเล่น & วัฒนธรรม</span>
          </button>

        </div>

        {/* Selected Mask visual Preview */}
        <div className="bg-neutral-950/70 border border-neutral-900 p-3.5 rounded-xl flex items-center gap-3 w-full max-w-sm text-left shadow-inner">
          <span 
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
            style={{ background: `radial-gradient(circle, ${activePreset.color} 0%, ${activePreset.secondaryColor} 100%)` }}
          >
            🎭
          </span>
          <div>
            <div className="text-[10px] uppercase text-neutral-400 font-mono">หน้ากากคู่ใจปัจจุบัน</div>
            <div className="text-sm font-bold text-white font-kanit">{activePreset.name}</div>
          </div>
          <button 
            onClick={handleOpenOptions}
            className="text-[10px] ml-auto text-amber-500 hover:underline font-bold font-kanit bg-amber-500/10 px-2 py-1 rounded"
            id="preview-change-mask"
          >
            เปลี่ยนชิ้นงาน
          </button>
        </div>

      </main>

      {/* Footer information section */}
      <footer className="w-full max-w-4xl text-center text-[11px] text-neutral-500 z-10 border-t border-neutral-900 pt-4 mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="font-kanit">© 2026 Dan Sai Adventure. พัฒนาขึ้นด้วยจิตวิญญาณแห่งวัฒนธรรมไทย</p>
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <Volume2 className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-mono">Volume: {Math.round(settings.soundVolume * 100)}%</span>
        </div>
      </footer>

      {/* Modals & Dialogs overlays */}
      <AnimatePresence>
        {showOptions && (
          <OptionsModal
            settings={settings}
            onSave={saveSettings}
            onClose={() => setShowOptions(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHowToPlay && (
          <HowToPlayModal
            onClose={() => setShowHowToPlay(false)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
