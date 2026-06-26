/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface KeyBindings {
  up: string;
  down: string;
  left: string;
  right: string;
  action: string;
}

export type MaskType = 'classic-red' | 'forest-green' | 'golden-sun' | 'indigo-spirit';

export interface CharacterPreset {
  id: MaskType;
  name: string;
  color: string;
  secondaryColor: string;
  description: string;
  speedMultiplier: number;
}

export interface GameSettings {
  keyBindings: KeyBindings;
  selectedMask: MaskType;
  difficulty: 'easy' | 'normal' | 'hard';
  soundVolume: number;
  enableParticles: boolean;
}

export interface GameState {
  score: number;
  lives: number;
  isGameOver: boolean;
  isPlaying: boolean;
  highScore: number;
}
