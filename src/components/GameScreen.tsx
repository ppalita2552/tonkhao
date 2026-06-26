/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Play, RotateCcw, Home, Shield, Award, Heart, Info, Star } from 'lucide-react';
import { GameSettings, GameState, KeyBindings } from '../types';
import { CHARACTER_PRESETS } from '../data/characters';
import { soundManager } from '../utils/audio';

interface GameScreenProps {
  settings: GameSettings;
  onBackToMenu: () => void;
  highScore: number;
  onNewHighScore: (score: number) => void;
}

// Global Game ref to pass high-performance variables between fiber and react
interface GameEngineState {
  playerX: number;
  playerZ: number;
  playerDirX: number;
  playerDirZ: number;
  playerAction: 'idle' | 'walk' | 'attack' | 'dance';
  actionTimer: number;
  score: number;
  lives: number;
  level: number;
  hasShield: boolean;
  isGameOver: boolean;
  enemies: Array<{
    id: number;
    x: number;
    z: number;
    speed: number;
    color: string;
    pulse: number;
    size: number;
    isHit: boolean;
    hitTimer: number;
    hp: number;
    dirX: number;
    actionState: 'idle' | 'walk';
    isFlashRed: boolean;
    isFlashWhite: boolean;
    yOffset?: number;
    vy?: number;
    vx?: number;
    vz?: number;
    rotX?: number;
    rotY?: number;
    rotZ?: number;
    isFlyingOut?: boolean;
  }>;
  grasses: Array<{
    id: number;
    x: number;
    z: number;
    scaleY: number;
    targetScaleY: number;
    size: number;
  }>;
  collectibles: Array<{
    id: number;
    x: number;
    z: number;
    type: 'rice' | 'water' | 'flower' | 'mask';
    size: number;
    bob: number;
  }>;
  particles: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    color: string;
    size: number;
    life: number;
    maxLife: number;
  }>;
  damageTexts: Array<{
    id: number;
    x: number;
    y: number;
    z: number;
    text: string;
    color: string;
    life: number;
  }>;
  danceSkillRadius: number;
  isDanceSkillActive: boolean;
  distanceToTemple: number;
  enemiesDefeatedCount: number;
  boss: any;
  fireballs: any[];
  warpPortal: any;
  isGameWon: boolean;
  enemySpawnTimer: number;
}

// Modular 3D Enemy Sprite with independent sprite sheets, flashing, and physics
function EnemySprite({ enemy, textureUrl }: { enemy: any; textureUrl: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tex = useTexture(textureUrl);
  
  // Clone texture to allow independent sprite coordinates per enemy
  const clonedTex = React.useMemo(() => {
    const t = tex.clone();
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(0.25, 0.50); // 4 columns, 2 rows
    t.needsUpdate = true;
    return t;
  }, [tex]);

  // Frame animation counter
  const frameRef = useRef<number>(Math.floor(Math.random() * 4));
  const animTimeRef = useRef<number>(0);

  useFrame((state, delta) => {
    // 1. Animate walking or idle sprite frame
    animTimeRef.current += delta;
    if (animTimeRef.current > 0.15) { // 150ms per frame
      animTimeRef.current = 0;
      frameRef.current = (frameRef.current + 1) % 4;
    }

    // Row 1 (Standing/Idle): UV offset Y = 0.50
    // Row 2 (Walking): UV offset Y = 0.00
    const rowY = enemy.actionState === 'idle' ? 0.50 : 0.00;
    const colX = frameRef.current * 0.25;
    clonedTex.offset.set(colX, rowY);

    // 2. Align 3D representation dynamically
    if (meshRef.current) {
      meshRef.current.position.set(enemy.x, 0.9 + (enemy.yOffset || 0), enemy.z);
      meshRef.current.rotation.set(enemy.rotX || 0, enemy.rotY || 0, enemy.rotZ || 0);

      // Mirror texture horizontally depending on movement direction
      // Default is facing left (default direction is dirX < 0)
      // If moving right (dirX > 0), scale.x is flipped to negative to mirror
      const scaleX = enemy.dirX > 0 ? -1.8 * enemy.size : 1.8 * enemy.size;
      meshRef.current.scale.set(scaleX, 1.8 * enemy.size, 1.0);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial 
        map={clonedTex}
        transparent
        alphaTest={0.45}
        side={THREE.DoubleSide}
        color={enemy.isFlashRed ? '#ff2222' : enemy.isFlashWhite ? '#ffffff' : '#ffffff'}
        emissive={enemy.isFlashRed ? '#ff0000' : enemy.isFlashWhite ? '#ffffff' : '#000000'}
        emissiveIntensity={enemy.isFlashRed ? 1.5 : enemy.isFlashWhite ? 2.0 : 0.0}
      />
    </mesh>
  );
}

// Modular 3D Boss Sprite
function BossSprite({ boss, textureUrl }: { boss: any; textureUrl: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tex = useTexture(textureUrl);
  
  // Clone texture to allow independent sprite coordinates for boss
  const clonedTex = React.useMemo(() => {
    const t = tex.clone();
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(0.50, 0.50); // 2 columns, 2 rows
    t.needsUpdate = true;
    return t;
  }, [tex]);

  useFrame((state, delta) => {
    // Row Y offsets: 
    // Row 1 (Idle/Dash): offset Y = 0.50
    // Row 2 (Charging/Action): offset Y = 0.00
    const rowY = boss.state === 'charging' ? 0.00 : 0.50;
    const colX = boss.frame * 0.50;
    clonedTex.offset.set(colX, rowY);

    if (meshRef.current) {
      meshRef.current.position.set(boss.x, boss.y, boss.z);
      
      const baseSize = 4.0;
      const scaleX = boss.dirX > 0 ? -baseSize * boss.scale : baseSize * boss.scale;
      meshRef.current.scale.set(scaleX, baseSize * boss.scale, 1.0);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial 
        map={clonedTex}
        transparent
        alphaTest={0.45}
        side={THREE.DoubleSide}
        color={boss.isHit ? '#ffffff' : '#ffffff'}
        emissive={boss.isHit ? '#ff0000' : '#000000'}
        emissiveIntensity={boss.isHit ? 2.5 : 0.0}
      />
    </mesh>
  );
}

// Mystical Rotating Torus Portal for Warp Portal
function PortalMesh() {
  const portalRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (portalRef.current) {
      portalRef.current.rotation.z += 2.5 * delta;
      portalRef.current.rotation.y += 1.0 * delta;
    }
  });
  return (
    <mesh ref={portalRef}>
      <torusGeometry args={[1.2, 0.18, 16, 32]} />
      <meshStandardMaterial 
        color="#10b981" 
        emissive="#059669" 
        emissiveIntensity={2.5} 
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  );
}

// Inner 3D Scene of the Game
function Scene3D({
  settings,
  engine,
  keys,
  onStateUpdate,
  isPaused
}: {
  settings: GameSettings;
  engine: React.MutableRefObject<GameEngineState>;
  keys: React.MutableRefObject<{ [key: string]: boolean }>;
  onStateUpdate: (score: number, lives: number, hasShield: boolean, level: number, distance: number, isGameOver: boolean, isGameWon: boolean) => void;
  isPaused: boolean;
}) {
  const { camera } = useThree();
  
  // Load textures
  const groundTex = useTexture('https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/ground_d1kjrx.png');
  const playerTex = useTexture('https://res.cloudinary.com/dsucg33fv/image/upload/v1782439981/player_mask_fmn9yv.png');
  const maskTex = useTexture('https://res.cloudinary.com/dsucg33fv/image/upload/v1782439981/item_a371ol.png');
  const enemyTex = useTexture('https://res.cloudinary.com/dsucg33fv/image/upload/v1782439979/enemy_mp1zhh.png');
  const grassTex = useTexture('https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/grass_2_kjkske.png');

  // Configure Ground texture tiling
  useEffect(() => {
    if (groundTex) {
      groundTex.wrapS = THREE.RepeatWrapping;
      groundTex.wrapT = THREE.RepeatWrapping;
      groundTex.repeat.set(25, 25);
    }
  }, [groundTex]);

  // Configure Player Sprite Sheet
  useEffect(() => {
    if (playerTex) {
      playerTex.wrapS = THREE.ClampToEdgeWrapping;
      playerTex.wrapT = THREE.ClampToEdgeWrapping;
      playerTex.repeat.set(0.25, 0.25);
    }
  }, [playerTex]);

  // Object references for direct ThreeJS manipulations
  const playerRef = useRef<THREE.Mesh>(null);
  const groundRef = useRef<THREE.Mesh>(null);
  const enemiesGroupRef = useRef<THREE.Group>(null);
  const collectiblesGroupRef = useRef<THREE.Group>(null);
  const particlesGroupRef = useRef<THREE.Group>(null);
  const skillRingRef = useRef<THREE.Mesh>(null);

  // Frame animators
  const playerFrameRef = useRef<number>(0);
  const animTimeRef = useRef<number>(0);

  // Setup initial scene elements
  useEffect(() => {
    // Reset Engine State on Mount
    engine.current.playerX = 0;
    engine.current.playerZ = 0;
    engine.current.playerAction = 'idle';
    engine.current.actionTimer = 0;
    engine.current.enemies = [];
    engine.current.grasses = [];
    engine.current.collectibles = [];
    engine.current.particles = [];
    engine.current.damageTexts = [];
    engine.current.danceSkillRadius = 0;
    engine.current.isDanceSkillActive = false;
    engine.current.distanceToTemple = 1000;
    engine.current.enemiesDefeatedCount = 0;
    engine.current.boss = null;
    engine.current.fireballs = [];
    engine.current.warpPortal = null;
    engine.current.isGameWon = false;
    engine.current.enemySpawnTimer = 2.0;

    // Spawn grasses spread across the map
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 46; // Ground bounds -23 to 23
      const z = (Math.random() - 0.5) * 46;
      engine.current.grasses.push({
        id: Math.random(),
        x,
        z,
        scaleY: 1.0,
        targetScaleY: 1.0,
        size: 0.8 + Math.random() * 0.4
      });
    }

    // Spawn initial items & enemies far from origin
    for (let i = 0; i < 12; i++) {
      spawnEnemy(engine.current);
    }
    for (let i = 0; i < 15; i++) {
      spawnCollectible(engine.current);
    }
  }, []);

  const spawnEnemy = (state: GameEngineState) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 30 + 10;
    const x = state.playerX + Math.cos(angle) * dist;
    const z = state.playerZ + Math.sin(angle) * dist;
    
    // Clamp to ground boundaries
    const clampedX = Math.max(-24, Math.min(24, x));
    const clampedZ = Math.max(-24, Math.min(24, z));

    state.enemies.push({
      id: Math.random(),
      x: clampedX,
      z: clampedZ,
      speed: 1.5 + Math.random() * 1.5 + (state.level * 0.25),
      color: ['#ff4444', '#aa44ff', '#00ffcc', '#ff9900'][Math.floor(Math.random() * 4)],
      pulse: Math.random() * 10,
      size: 0.8 + Math.random() * 0.4,
      isHit: false,
      hitTimer: 0,
      hp: 2,
      dirX: Math.random() > 0.5 ? 1 : -1,
      actionState: 'walk',
      isFlashRed: false,
      isFlashWhite: false,
      yOffset: 0,
      vy: 0,
      vx: 0,
      vz: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      isFlyingOut: false
    });
  };

  const spawnCollectible = (state: GameEngineState) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 30 + 5;
    const x = state.playerX + Math.cos(angle) * dist;
    const z = state.playerZ + Math.sin(angle) * dist;

    // Clamp to ground boundaries
    const clampedX = Math.max(-24, Math.min(24, x));
    const clampedZ = Math.max(-24, Math.min(24, z));

    const types: ('rice' | 'water' | 'flower' | 'mask')[] = ['rice', 'rice', 'water', 'flower', 'mask'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    state.collectibles.push({
      id: Math.random(),
      x: clampedX,
      z: clampedZ,
      type: chosenType,
      size: chosenType === 'flower' ? 0.8 : chosenType === 'water' ? 0.7 : chosenType === 'mask' ? 1.0 : 0.6,
      bob: Math.random() * 10
    });
  };

  const createExplosion = (state: GameEngineState, x: number, y: number, z: number, color: string, count = 12) => {
    if (!settings.enableParticles) return;
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 2;
      state.particles.push({
        id: Math.random(),
        x,
        y,
        z,
        vx: Math.cos(theta) * speed * 0.05,
        vy: (Math.random() * 5 + 2) * 0.05,
        vz: Math.sin(theta) * speed * 0.05,
        color,
        size: Math.random() * 0.15 + 0.08,
        life: 0,
        maxLife: Math.random() * 20 + 15
      });
    }
  };

  const createDamageText = (state: GameEngineState, x: number, y: number, z: number, text: string, color: string) => {
    state.damageTexts.push({
      id: Math.random(),
      x,
      y,
      z,
      text,
      color,
      life: 1.0 // opacity factor
    });
  };

  // Main high-performance fiber animation loop
  useFrame((state, delta) => {
    const dt = Math.min(0.05, delta); // Cap delta to prevent massive jumps
    const engineState = engine.current;

    if (engineState.isGameOver || isPaused) return;

    // 1. Move Player Character with WASD or Arrow Keys (8 Directions)
    let moveX = 0;
    let moveZ = 0;

    const upKey = settings.keyBindings.up;
    const downKey = settings.keyBindings.down;
    const leftKey = settings.keyBindings.left;
    const rightKey = settings.keyBindings.right;

    // Check custom controls
    if (keys.current['w'] || keys.current['W'] || keys.current[upKey]) moveZ -= 1;
    if (keys.current['s'] || keys.current['S'] || keys.current[downKey]) moveZ += 1;
    if (keys.current['a'] || keys.current['A'] || keys.current[leftKey]) moveX -= 1;
    if (keys.current['d'] || keys.current['D'] || keys.current[rightKey]) moveX += 1;

    // Diagonal Normalization
    if (moveX !== 0 && moveZ !== 0) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len;
      moveZ /= len;
    }

    // Handle Attack Action (P key)
    if (keys.current['p'] || keys.current['P']) {
      keys.current['p'] = false;
      keys.current['P'] = false;
      
      if (engineState.playerAction !== 'attack' && engineState.playerAction !== 'dance') {
        engineState.playerAction = 'attack';
        engineState.actionTimer = 0.4; // 400ms duration
        soundManager.playJump(); // Punch whoosh
        
        // Spawn sparks in front of player
        const lookDirX = engineState.playerDirX;
        const lookDirZ = engineState.playerDirZ;
        createExplosion(
          engineState,
          engineState.playerX + lookDirX * 1.5,
          1.0,
          engineState.playerZ + lookDirZ * 1.5,
          '#facc15',
          15
        );

        // Check hit against Boss
        if (engineState.boss && !engineState.boss.isHit) {
          const boss = engineState.boss;
          const distToBoss = Math.sqrt(
            Math.pow(boss.x - (engineState.playerX + lookDirX * 1.2), 2) +
            Math.pow(boss.z - (engineState.playerZ + lookDirZ * 1.2), 2)
          );
          if (distToBoss < 2.5) {
            boss.isHit = true;
            boss.hitTimer = 0.5;
            boss.hp -= 1;
            soundManager.playHit();
            
            createDamageText(engineState, boss.x, boss.y, boss.z, `BOSS HIT! HP: ${boss.hp}/${boss.maxHp}`, '#f59e0b');
            createExplosion(engineState, boss.x, boss.y, boss.z, '#fbbf24', 25);
            
            if (boss.hp <= 0) {
              createDamageText(engineState, boss.x, boss.y, boss.z, '🔥 BOSS DEFEATED! 🔥', '#a78bfa');
              createExplosion(engineState, boss.x, boss.y, boss.z, '#ef4444', 60);
              engineState.warpPortal = {
                x: boss.x,
                z: boss.z,
                active: true
              };
              engineState.boss = null;
            }
          }
        }

        // Check melee hit against all nearby enemies
        for (let i = engineState.enemies.length - 1; i >= 0; i--) {
          const enemy = engineState.enemies[i];
          if (enemy.isFlyingOut) continue;

          const dist = Math.sqrt(
            Math.pow(enemy.x - (engineState.playerX + lookDirX * 1.2), 2) +
            Math.pow(enemy.z - (engineState.playerZ + lookDirZ * 1.2), 2)
          );

          if (dist < 2.2 && !enemy.isHit) {
            enemy.isHit = true;
            enemy.hitTimer = 0.4;
            soundManager.playHit();
            
            enemy.hp -= 1;

            if (enemy.hp === 1) {
              // FIRST HIT: Knock back in player's look direction
              enemy.isFlashRed = true;
              setTimeout(() => { enemy.isFlashRed = false; }, 250);

              createDamageText(engineState, enemy.x, 2.0, enemy.z, 'KNOCKBACK! -1 HP', '#fbbf24');
              createExplosion(engineState, enemy.x, 1.0, enemy.z, '#ffaa00', 15);

              // Set knockback velocities
              const force = 14.0;
              enemy.vx = lookDirX * force;
              enemy.vz = lookDirZ * force;
              enemy.vy = 2.0; // slight lift-up hop
              enemy.actionState = 'idle';

              // Recover state after 0.4s
              setTimeout(() => {
                enemy.isHit = false;
                enemy.vx = 0;
                enemy.vz = 0;
                enemy.vy = 0;
                enemy.actionState = 'walk';
              }, 400);

            } else if (enemy.hp <= 0) {
              // SECOND HIT: Fly out of screen or flash white rapidly & vanish
              enemy.isFlyingOut = true;
              enemy.isFlashWhite = true;
              engineState.enemiesDefeatedCount = (engineState.enemiesDefeatedCount || 0) + 1;
              
              // Extreme knockback values
              const force = 22.0;
              enemy.vx = lookDirX * force;
              enemy.vz = lookDirZ * force;
              enemy.vy = 16.0; // flies way up in the air!
              enemy.rotX = (Math.random() - 0.5) * 15;
              enemy.rotY = (Math.random() - 0.5) * 15;
              enemy.rotZ = (Math.random() - 0.5) * 15;

              createDamageText(engineState, enemy.x, 2.0, enemy.z, 'OUT OF ARENA! +50', '#ef4444');
              createExplosion(engineState, enemy.x, 1.0, enemy.z, '#ef4444', 25);
              
              engineState.score += 50;

              const targetId = enemy.id;
              setTimeout(() => {
                const idx = engineState.enemies.findIndex(e => e.id === targetId);
                if (idx !== -1) {
                  engineState.enemies.splice(idx, 1);
                  spawnEnemy(engineState); // Replenish
                }
              }, 1200);
            }
          }
        }
      }
    }

    // Handle Dance Skill Action (O key)
    if (keys.current['o'] || keys.current['O']) {
      keys.current['o'] = false;
      keys.current['O'] = false;

      if (engineState.playerAction !== 'dance' && engineState.playerAction !== 'attack') {
        engineState.playerAction = 'dance';
        engineState.actionTimer = 1.2; // 1.2s dancing
        engineState.isDanceSkillActive = true;
        engineState.danceSkillRadius = 0.5;
        soundManager.playLevelUp(); // Divine chant
        
        createExplosion(engineState, engineState.playerX, 0.5, engineState.playerZ, '#a78bfa', 30);
        createDamageText(engineState, engineState.playerX, 2.5, engineState.playerZ, 'PHI TA KHON DANCE!', '#c084fc');
      }
    }

    // Manage Action Timer
    if (engineState.actionTimer > 0) {
      engineState.actionTimer -= dt;
      if (engineState.actionTimer <= 0) {
        engineState.playerAction = 'idle';
        engineState.isDanceSkillActive = false;
        engineState.danceSkillRadius = 0;
      }
    }

    // Update Player Movement & Speed
    if (engineState.playerAction !== 'attack' && engineState.playerAction !== 'dance') {
      if (moveX !== 0 || moveZ !== 0) {
        const speed = 7.5 * (settings.difficulty === 'easy' ? 0.9 : settings.difficulty === 'normal' ? 1.0 : 1.25);
        engineState.playerX += moveX * speed * dt;
        engineState.playerZ += moveZ * speed * dt;

        // Keep face direction
        engineState.playerDirX = moveX;
        engineState.playerDirZ = moveZ;

        engineState.playerAction = 'walk';
        engineState.distanceToTemple = Math.max(0, engineState.distanceToTemple - speed * dt * 0.5);

        // Periodic walk trail particles
        if (Math.random() < 0.25) {
          createExplosion(engineState, engineState.playerX, 0.1, engineState.playerZ, '#d97706', 2);
        }
      } else {
        engineState.playerAction = 'idle';
      }
    }

    // Ground Boundaries Clamping (size 50 plane -> range -24.5 to 24.5)
    engineState.playerX = Math.max(-24.5, Math.min(24.5, engineState.playerX));
    engineState.playerZ = Math.max(-24.5, Math.min(24.5, engineState.playerZ));

    // Handle Dance Skill expanding ring mechanics
    if (engineState.isDanceSkillActive) {
      engineState.danceSkillRadius += 10 * dt; // Rapidly expand ring

      // Purify the Boss if caught in the expanding ring
      if (engineState.boss && !engineState.boss.isHit) {
        const boss = engineState.boss;
        const distToBoss = Math.sqrt(
          Math.pow(boss.x - engineState.playerX, 2) +
          Math.pow(boss.z - engineState.playerZ, 2)
        );
        if (distToBoss <= engineState.danceSkillRadius) {
          boss.isHit = true;
          boss.hitTimer = 0.5;
          boss.hp -= 2; // Dance skill deals 2 damage to Boss!
          soundManager.playHit();
          
          createDamageText(engineState, boss.x, boss.y, boss.z, `BOSS PURIFIED! HP: ${boss.hp}/${boss.maxHp}`, '#a78bfa');
          createExplosion(engineState, boss.x, boss.y, boss.z, '#c084fc', 30);
          
          if (boss.hp <= 0) {
            createDamageText(engineState, boss.x, boss.y, boss.z, '🔥 BOSS DEFEATED! 🔥', '#a78bfa');
            createExplosion(engineState, boss.x, boss.y, boss.z, '#ef4444', 60);
            engineState.warpPortal = {
              x: boss.x,
              z: boss.z,
              active: true
            };
            engineState.boss = null;
          }
        }
      }
      
      // Purify any enemies caught in the expanding ring
      for (let i = engineState.enemies.length - 1; i >= 0; i--) {
        const enemy = engineState.enemies[i];
        const dist = Math.sqrt(
          Math.pow(enemy.x - engineState.playerX, 2) +
          Math.pow(enemy.z - engineState.playerZ, 2)
        );

        if (dist <= engineState.danceSkillRadius && dist > engineState.danceSkillRadius - 2.5 && !enemy.isHit && !enemy.isFlyingOut) {
          enemy.isHit = true;
          enemy.isFlyingOut = true;
          enemy.isFlashWhite = true;
          engineState.enemiesDefeatedCount = (engineState.enemiesDefeatedCount || 0) + 1;
          soundManager.playCollect();
          
          // Random launch angle away from player
          const angle = Math.atan2(enemy.z - engineState.playerZ, enemy.x - engineState.playerX);
          const force = 25.0;
          enemy.vx = Math.cos(angle) * force;
          enemy.vz = Math.sin(angle) * force;
          enemy.vy = 18.0;
          enemy.rotX = (Math.random() - 0.5) * 15;
          enemy.rotY = (Math.random() - 0.5) * 15;
          enemy.rotZ = (Math.random() - 0.5) * 15;

          createDamageText(engineState, enemy.x, 2.0, enemy.z, 'PURIFIED! +50', '#a78bfa');
          createExplosion(engineState, enemy.x, 1.0, enemy.z, '#ec4899', 18);
          
          engineState.score += 50;
          
          const targetId = enemy.id;
          setTimeout(() => {
            const idx = engineState.enemies.findIndex(e => e.id === targetId);
            if (idx !== -1) {
              engineState.enemies.splice(idx, 1);
              spawnEnemy(engineState);
            }
          }, 1200);
        }
      }
    }

    // 2. Update Sprite Animations Row & Column offsets
    animTimeRef.current += dt;
    if (animTimeRef.current > 0.12) { // 120ms frame speed
      animTimeRef.current = 0;
      playerFrameRef.current = (playerFrameRef.current + 1) % 4;
    }

    // Set sprite sheet rows:
    // Row 1: Idle -> UV y offset = 0.75
    // Row 2: Walk -> UV y offset = 0.50
    // Row 3: Attack -> UV y offset = 0.25
    // Row 4: Dance -> UV y offset = 0.00
    let rowOffset = 0.75;
    if (engineState.playerAction === 'walk') rowOffset = 0.50;
    else if (engineState.playerAction === 'attack') rowOffset = 0.25;
    else if (engineState.playerAction === 'dance') rowOffset = 0.00;

    const colOffset = playerFrameRef.current * 0.25;
    if (playerTex) {
      playerTex.offset.set(colOffset, rowOffset);
    }

    // Update visual mesh translation
    if (playerRef.current) {
      playerRef.current.position.set(engineState.playerX, 1.0, engineState.playerZ);
      
      // Mirror sprite horizontally if running left
      if (engineState.playerDirX < 0) {
        playerRef.current.scale.set(-2, 2, 2);
      } else {
        playerRef.current.scale.set(2, 2, 2);
      }
    }

    // 3. Move Camera to follow player with smooth interpolation
    const targetCamX = engineState.playerX;
    const targetCamY = 11.0;
    const targetCamZ = engineState.playerZ + 12.0;

    camera.position.x += (targetCamX - camera.position.x) * 5 * dt;
    camera.position.y += (targetCamY - camera.position.y) * 5 * dt;
    camera.position.z += (targetCamZ - camera.position.z) * 5 * dt;
    camera.lookAt(engineState.playerX, 0.5, engineState.playerZ);

    // 4. Update Enemies Central Simulation
    engineState.enemies.forEach((enemy) => {
      if (enemy.isFlyingOut || enemy.vx || enemy.vz || enemy.vy) {
        // Apply physical velocities
        enemy.x += (enemy.vx || 0) * dt;
        enemy.z += (enemy.vz || 0) * dt;
        if (enemy.yOffset === undefined) enemy.yOffset = 0;
        enemy.yOffset += (enemy.vy || 0) * dt;

        if (enemy.isFlyingOut) {
          enemy.vy = (enemy.vy || 0) - 22.0 * dt; // Gravity pull

          // Spin around during flight out
          enemy.rotX = (enemy.rotX || 0) + (enemy.vx || 0) * dt * 0.4;
          enemy.rotY = (enemy.rotY || 0) + (enemy.vy || 0) * dt * 0.4;
          enemy.rotZ = (enemy.rotZ || 0) + (enemy.vz || 0) * dt * 0.4;
        } else {
          // Knockback friction/decay
          enemy.vx = (enemy.vx || 0) * Math.exp(-8.0 * dt);
          enemy.vz = (enemy.vz || 0) * Math.exp(-8.0 * dt);
          enemy.vy = (enemy.vy || 0) * Math.exp(-8.0 * dt);
        }
      } else {
        // Normal pursuit of player
        const dx = engineState.playerX - enemy.x;
        const dz = engineState.playerZ - enemy.z;
        const len = Math.sqrt(dx * dx + dz * dz);

        if (len > 0.1) {
          enemy.x += (dx / len) * enemy.speed * dt;
          enemy.z += (dz / len) * enemy.speed * dt;
          enemy.dirX = dx > 0 ? 1 : -1;
          enemy.actionState = 'walk';
        } else {
          enemy.actionState = 'idle';
        }

        // Player direct damage collision
        if (len < 1.1 && !enemy.isHit && engineState.playerAction !== 'dance' && engineState.playerAction !== 'attack') {
          if (engineState.hasShield) {
            engineState.hasShield = false;
            enemy.isHit = true;
            enemy.isFlashRed = true;
            setTimeout(() => { enemy.isFlashRed = false; }, 400);

            soundManager.playHit();
            createDamageText(engineState, engineState.playerX, 2.0, engineState.playerZ, 'SHIELD BROKEN!', '#38bdf8');
            createExplosion(engineState, enemy.x, 1.0, enemy.z, '#38bdf8', 15);
          } else {
            engineState.lives = Math.max(0, engineState.lives - 1);
            enemy.isHit = true;
            enemy.isFlashRed = true;
            setTimeout(() => { enemy.isFlashRed = false; }, 400);

            soundManager.playHit();
            createDamageText(engineState, engineState.playerX, 2.0, engineState.playerZ, 'Ouch! -1 Life', '#ef4444');
            createExplosion(engineState, engineState.playerX, 1.0, engineState.playerZ, '#ff2200', 25);
            
            if (engineState.lives <= 0) {
              engineState.isGameOver = true;
              soundManager.playGameOver();
            }
          }

          // Repel enemy
          const repelAngle = Math.atan2(enemy.z - engineState.playerZ, enemy.x - engineState.playerX);
          enemy.x += Math.cos(repelAngle) * 4.0;
          enemy.z += Math.sin(repelAngle) * 4.0;
          setTimeout(() => { enemy.isHit = false; }, 1000);
        }
      }
    });

    // 4b. Update Grasses Squashing Mechanics
    if (engineState.grasses) {
      engineState.grasses.forEach((grass) => {
        const dx = engineState.playerX - grass.x;
        const dz = engineState.playerZ - grass.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < 0.95) {
          grass.targetScaleY = 0.12; // Squash it flat!
        } else {
          grass.targetScaleY = 1.0;  // Normal standing height
        }
        
        // Smoothly interpolate scale
        grass.scaleY += (grass.targetScaleY - grass.scaleY) * 12.0 * dt;
      });
    }

    // 5. Update Collectibles
    if (collectiblesGroupRef.current) {
      const children = collectiblesGroupRef.current.children;
      for (let i = engineState.collectibles.length - 1; i >= 0; i--) {
        const col = engineState.collectibles[i];
        const mesh = children[i] as THREE.Mesh;
        if (mesh) {
          // Bobbing/Spinning animation
          mesh.position.set(col.x, 0.4 + Math.sin(state.clock.elapsedTime * 4 + col.bob) * 0.12, col.z);
          mesh.rotation.y += dt * 1.5;

          // Check Collection range
          const dist = Math.sqrt(
            Math.pow(col.x - engineState.playerX, 2) +
            Math.pow(col.z - engineState.playerZ, 2)
          );

          if (dist < 1.3) {
            soundManager.playCollect();
            createExplosion(engineState, col.x, 0.8, col.z, col.type === 'flower' ? '#ec4899' : col.type === 'water' ? '#06b6d4' : col.type === 'mask' ? '#ef4444' : '#f59e0b', 12);
            
            if (col.type === 'rice') {
              engineState.score += 10;
              createDamageText(engineState, col.x, 1.5, col.z, '+10 RICE', '#facc15');
            } else if (col.type === 'water') {
              engineState.hasShield = true;
              createDamageText(engineState, col.x, 1.5, col.z, 'WATER SHIELD!', '#38bdf8');
            } else if (col.type === 'flower') {
              engineState.score += 50;
              createDamageText(engineState, col.x, 1.5, col.z, 'SACRED FLOWER +50', '#10b981');
            } else if (col.type === 'mask') {
              engineState.lives = Math.min(5, engineState.lives + 1);
              engineState.score += 30;
              createDamageText(engineState, col.x, 1.5, col.z, 'HEAL +1 HP! +30', '#ef4444');
            }

            // Remove and spawn new one
            engineState.collectibles.splice(i, 1);
            spawnCollectible(engineState);
          }
        }
      }
    }

    // 6. Update Particles
    for (let i = engineState.particles.length - 1; i >= 0; i--) {
      const p = engineState.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vy -= 0.0015; // light gravity
      p.life += 1;
      if (p.life >= p.maxLife) {
        engineState.particles.splice(i, 1);
      }
    }

    // Update Skill Ring visuals
    if (skillRingRef.current) {
      if (engineState.isDanceSkillActive) {
        skillRingRef.current.visible = true;
        skillRingRef.current.position.set(engineState.playerX, 0.1, engineState.playerZ);
        skillRingRef.current.scale.set(engineState.danceSkillRadius * 2, engineState.danceSkillRadius * 2, 1);
      } else {
        skillRingRef.current.visible = false;
      }
    }

    // 7. Check Level Finished
    if (engineState.distanceToTemple <= 0) {
      soundManager.playLevelUp();
      engineState.level += 1;
      engineState.distanceToTemple = 1000;
      createExplosion(engineState, engineState.playerX, 1.0, engineState.playerZ, '#10b981', 40);
      createDamageText(engineState, engineState.playerX, 2.5, engineState.playerZ, `LEVEL COMPLETED! UP TO LEVEL ${engineState.level}`, '#10b981');
    }

    // 8. Random Enemy Spawning (from all directions every 1-3 seconds)
    if (!engineState.isGameOver && !engineState.isGameWon) {
      engineState.enemySpawnTimer = (engineState.enemySpawnTimer ?? 2.0) - dt;
      if (engineState.enemySpawnTimer <= 0) {
        spawnEnemy(engineState);
        engineState.enemySpawnTimer = 1.0 + Math.random() * 2.0;
      }
    }

    // 9. Boss Spawning (When >= 10 enemies are defeated)
    if (!engineState.boss && !engineState.isGameWon && (engineState.enemiesDefeatedCount || 0) >= 10) {
      engineState.boss = {
        x: 0,
        z: -12,
        y: 4.5,
        hp: 12,
        maxHp: 12,
        state: 'idle',
        timer: 2.0,
        scale: 1.0,
        dirX: -1,
        targetX: 0,
        targetZ: -12,
        isHit: false,
        hitTimer: 0,
        frame: 0,
        animTimer: 0
      };
      createExplosion(engineState, 0, 4.5, -12, '#a78bfa', 40);
      createDamageText(engineState, 0, 5.5, -12, '⚠️ THE GUARDIAN BOSS APPEARS! ⚠️', '#ef4444');
    }

    // 10. Boss AI State Machine Update
    if (engineState.boss) {
      const boss = engineState.boss;
      
      // Animation frame step
      boss.animTimer += dt;
      if (boss.animTimer > 0.2) {
        boss.animTimer = 0;
        boss.frame = (boss.frame + 1) % 2;
      }

      if (boss.isHit) {
        boss.hitTimer -= dt;
        if (boss.hitTimer <= 0) {
          boss.isHit = false;
        }
      }

      boss.timer -= dt;

      if (boss.state === 'idle') {
        boss.y = 3.5 + Math.sin(state.clock.elapsedTime * 4) * 0.4;
        boss.scale = 1.0;
        
        if (boss.timer <= 0) {
          const r = Math.random();
          if (r < 0.6) {
            boss.state = 'dashing';
            boss.timer = 1.2;
            const isClose = Math.random() < 0.5;
            const dist = isClose ? 4.0 + Math.random() * 3.0 : 12.0 + Math.random() * 8.0;
            const angle = Math.random() * Math.PI * 2;
            boss.targetX = Math.max(-23, Math.min(23, engineState.playerX + Math.cos(angle) * dist));
            boss.targetZ = Math.max(-23, Math.min(23, engineState.playerZ + Math.sin(angle) * dist));
            boss.dirX = boss.targetX > boss.x ? 1 : -1;
          } else {
            boss.state = 'charging';
            boss.timer = 1.5;
          }
        }
      } else if (boss.state === 'dashing') {
        boss.x += (boss.targetX - boss.x) * 4.0 * dt;
        boss.z += (boss.targetZ - boss.z) * 4.0 * dt;
        boss.y = 3.5 + Math.sin(state.clock.elapsedTime * 6) * 0.3;
        boss.scale = 1.0;

        if (boss.timer <= 0) {
          boss.state = 'idle';
          boss.timer = 0.8 + Math.random() * 1.0;
        }
      } else if (boss.state === 'charging') {
        //ขยายย่อเป็นจังหวะบอก
        const pump = Math.sin(state.clock.elapsedTime * 25) * 0.25;
        boss.scale = 1.0 + pump;
        boss.y = 3.5;

        if (boss.timer <= 0) {
          soundManager.playLevelUp(); // Sound feedback
          createDamageText(engineState, boss.x, boss.y + 1.5, boss.z, '🔥 FIRE STORM! 🔥', '#ef4444');
          
          // Spawn 3 fireballs
          for (let i = 0; i < 3; i++) {
            const targetX = Math.max(-24, Math.min(24, engineState.playerX + (Math.random() - 0.5) * 5.0));
            const targetZ = Math.max(-24, Math.min(24, engineState.playerZ + (Math.random() - 0.5) * 5.0));
            
            if (!engineState.fireballs) engineState.fireballs = [];
            engineState.fireballs.push({
              id: Math.random(),
              startX: boss.x,
              startZ: boss.z,
              targetX,
              targetZ,
              x: boss.x,
              y: boss.y,
              z: boss.z,
              progress: 0,
              speed: 0.6 + Math.random() * 0.3,
              size: 1.0
            });
          }

          boss.state = 'idle';
          boss.timer = 1.5 + Math.random() * 1.0;
          boss.scale = 1.0;
        }
      }
    }

    // 11. Update Fireballs physics and collision
    if (engineState.fireballs) {
      for (let i = engineState.fireballs.length - 1; i >= 0; i--) {
        const f = engineState.fireballs[i];
        f.progress += f.speed * dt;
        
        if (f.progress >= 1.0) {
          createExplosion(engineState, f.targetX, 0.4, f.targetZ, '#ef4444', 25);
          soundManager.playHit();
          
          const pDist = Math.sqrt(
            Math.pow(engineState.playerX - f.targetX, 2) +
            Math.pow(engineState.playerZ - f.targetZ, 2)
          );
          
          if (pDist < 1.8) {
            if (engineState.hasShield) {
              engineState.hasShield = false;
              createDamageText(engineState, engineState.playerX, 2.0, engineState.playerZ, 'SHIELD BROKEN!', '#38bdf8');
            } else {
              engineState.lives = Math.max(0, engineState.lives - 1);
              createDamageText(engineState, engineState.playerX, 2.0, engineState.playerZ, 'DIRECT FIRE HIT! -1 HP', '#ef4444');
              if (engineState.lives <= 0) {
                engineState.isGameOver = true;
                soundManager.playGameOver();
              }
            }
          }
          engineState.fireballs.splice(i, 1);
        } else {
          f.x = f.startX + (f.targetX - f.startX) * f.progress;
          f.z = f.startZ + (f.targetZ - f.startZ) * f.progress;
          const peakHeight = 11.0;
          f.y = (1.0 - f.progress) * 3.5 + 4.0 * peakHeight * f.progress * (1.0 - f.progress);
          
          if (Math.random() < 0.4) {
            engineState.particles.push({
              id: Math.random(),
              x: f.x,
              y: f.y,
              z: f.z,
              vx: (Math.random() - 0.5) * 0.1,
              vy: (Math.random() - 0.5) * 0.1,
              vz: (Math.random() - 0.5) * 0.1,
              color: '#f97316',
              size: 0.15,
              life: 0,
              maxLife: 10
            });
          }
        }
      }
    }

    // 12. Warp Portal Interaction
    if (engineState.warpPortal && engineState.warpPortal.active) {
      const portal = engineState.warpPortal;
      const dist = Math.sqrt(
        Math.pow(engineState.playerX - portal.x, 2) +
        Math.pow(engineState.playerZ - portal.z, 2)
      );
      
      if (dist < 1.4) {
        engineState.isGameWon = true;
        soundManager.playLevelUp();
        createExplosion(engineState, engineState.playerX, 1.0, engineState.playerZ, '#10b981', 50);
      }
    }

    // Sync state values with React callback
    onStateUpdate(
      engineState.score,
      engineState.lives,
      engineState.hasShield,
      engineState.level,
      engineState.distanceToTemple,
      engineState.isGameOver,
      engineState.isGameWon
    );
  });

  return (
    <>
      {/* 3D Atmospheric Background Space */}
      <color attach="background" args={['#030712']} />
      
      {/* Mystical Moonlit directional shadow light */}
      <ambientLight intensity={1.1} />
      <directionalLight 
        position={[8, 15, 8]} 
        intensity={1.6} 
        castShadow 
        shadow-mapSize-width={1024} 
        shadow-mapSize-height={1024} 
      />
      <pointLight position={[0, 10, 0]} intensity={1.2} distance={40} color="#ffaa66" />

      {/* Decorative Traditional Temple Gate / Shrine at the top boundary */}
      <mesh position={[0, 2.0, -24.5]}>
        <boxGeometry args={[6, 4, 1.5]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.4} />
      </mesh>
      {/* Traditional Golden Gate Roof */}
      <mesh position={[0, 4.3, -24.5]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[4.5, 4.5, 1.8]} />
        <meshStandardMaterial color="#eab308" metalness={0.5} roughness={0.2} />
      </mesh>

      {/* Ground Plane with repeating tile texture */}
      <mesh 
        ref={groundRef} 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
      >
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial map={groundTex} roughness={0.8} />
      </mesh>

      {/* Tiling Boundary Fences to keep aesthetics premium */}
      <gridHelper args={[50, 25, '#d97706', '#3f3f46']} position={[0, 0.05, 0]} />

      {/* Expanding Magical Circle/Ring for 'O' dance skill */}
      <mesh 
        ref={skillRingRef} 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0.1, 0]} 
        visible={false}
      >
        <ringGeometry args={[0.9, 1.0, 32]} />
        <meshBasicMaterial color="#c084fc" side={THREE.DoubleSide} transparent opacity={0.7} />
      </mesh>

      {/* Player character billboard 2D sprite */}
      <mesh ref={playerRef} castShadow receiveShadow position={[0, 1, 0]}>
        <planeGeometry args={[2.0, 2.0]} />
        <meshStandardMaterial 
          map={playerTex} 
          transparent 
          alphaTest={0.4} 
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Grass patches rendering group */}
      <group>
        {engine.current.grasses?.map((grass) => (
          <mesh 
            key={grass.id} 
            position={[grass.x, 0.45 * grass.scaleY, grass.z]} 
            scale={[grass.size, grass.scaleY * grass.size, grass.size]}
          >
            <planeGeometry args={[1.2, 1.2]} />
            <meshStandardMaterial 
              map={grassTex} 
              transparent 
              alphaTest={0.4} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        ))}
      </group>

      {/* Enemies rendering group */}
      <group ref={enemiesGroupRef}>
        {engine.current.enemies.map((enemy) => (
          <EnemySprite 
            key={enemy.id} 
            enemy={enemy} 
            textureUrl="https://res.cloudinary.com/dsucg33fv/image/upload/v1782439979/enemy_mp1zhh.png" 
          />
        ))}
      </group>

      {/* Boss rendering */}
      {engine.current.boss && (
        <BossSprite 
          boss={engine.current.boss} 
          textureUrl="https://res.cloudinary.com/dsucg33fv/image/upload/v1782439980/boss_pblkge.png" 
        />
      )}

      {/* Fireballs rendering with ground danger indicators */}
      {engine.current.fireballs?.map((f) => (
        <group key={f.id}>
          {/* Ground danger pulse indicator */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[f.targetX, 0.1, f.targetZ]}>
            <ringGeometry args={[0.1, 1.8 * f.progress, 32]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.65 * (1.0 - f.progress)} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[f.targetX, 0.08, f.targetZ]}>
            <circleGeometry args={[1.8, 32]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.15 * f.progress} side={THREE.DoubleSide} />
          </mesh>

          {/* Flying fireball */}
          <mesh position={[f.x, f.y, f.z]}>
            <sphereGeometry args={[0.55, 16, 16]} />
            <meshStandardMaterial 
              color="#f97316" 
              emissive="#ef4444" 
              emissiveIntensity={2.5} 
              roughness={0.1}
            />
          </mesh>
        </group>
      ))}

      {/* Warp Portal */}
      {engine.current.warpPortal?.active && (
        <group position={[engine.current.warpPortal.x, 1.2, engine.current.warpPortal.z]}>
          {/* Glowing field ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.1, 0]}>
            <ringGeometry args={[0.1, 1.6, 32]} />
            <meshBasicMaterial color="#10b981" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
          {/* Swirling Torus mesh */}
          <PortalMesh />
        </group>
      )}

      {/* Collectibles rendering group */}
      <group ref={collectiblesGroupRef}>
        {engine.current.collectibles.map((col) => {
          if (col.type === 'mask') {
            return (
              <mesh key={col.id} position={[col.x, 0.5, col.z]}>
                <planeGeometry args={[1.0, 1.0]} />
                <meshStandardMaterial 
                  map={maskTex} 
                  transparent 
                  alphaTest={0.4} 
                  side={THREE.DoubleSide} 
                />
              </mesh>
            );
          }
          return (
            <mesh key={col.id} position={[col.x, 0.4, col.z]}>
              {col.type === 'rice' ? (
                // Sticky Rice: Box/Cylinder
                <boxGeometry args={[0.6, 0.6, 0.6]} />
              ) : col.type === 'water' ? (
                // Water drop: Sphere
                <sphereGeometry args={[0.4, 8, 8]} />
              ) : (
                // Sacred Flower: Torus
                <torusGeometry args={[0.4, 0.15, 8, 16]} />
              )}
              <meshStandardMaterial 
                color={col.type === 'rice' ? '#facc15' : col.type === 'water' ? '#38bdf8' : '#ec4899'} 
                roughness={0.2}
                metalness={0.3}
              />
            </mesh>
          );
        })}
      </group>

      {/* 3D Visual Dust / Embers floating in space */}
      <group ref={particlesGroupRef}>
        {engine.current.particles.map((p) => (
          <mesh key={p.id} position={[p.x, p.y, p.z]}>
            <boxGeometry args={[p.size, p.size, p.size]} />
            <meshBasicMaterial color={p.color} transparent opacity={1 - p.life / p.maxLife} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// Fallback loader while textures assemble
function GameLoader() {
  return (
    <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center gap-3">
      <span className="text-4xl animate-spin">🏮</span>
      <h3 className="font-kanit text-lg font-bold text-amber-500 animate-pulse">กำลังเตรียมวิหาร 3D และหน้ากากผีตาโขน...</h3>
    </div>
  );
}

export default function GameScreen({ settings, onBackToMenu, highScore, onNewHighScore }: GameScreenProps) {
  // Global mutable keybindings engine to prevent state closure lag
  const keys = useRef<{ [key: string]: boolean }>({});
  
  // Game states synced back from Canvas engine to React for standard HTML HUD
  const [hudScore, setHudScore] = useState<number>(0);
  const [hudLives, setHudLives] = useState<number>(5);
  const [hudShield, setHudShield] = useState<boolean>(false);
  const [hudLevel, setHudLevel] = useState<number>(1);
  const [hudDistance, setHudDistance] = useState<number>(1000);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isGameWon, setIsGameWon] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Initialize key capture listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let key = e.key;
      if (e.code === 'Space') key = 'Space';
      keys.current[key] = true;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsPaused(prev => {
          const next = !prev;
          soundManager.playMenuSelect();
          return next;
        });
        return;
      }

      // Stop default window scrolling for captured gaming bindings
      const capturedKeys = [
        settings.keyBindings.up,
        settings.keyBindings.down,
        settings.keyBindings.left,
        settings.keyBindings.right,
        settings.keyBindings.action,
        'p', 'P', 'o', 'O'
      ];
      if (capturedKeys.includes(key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      let key = e.key;
      if (e.code === 'Space') key = 'Space';
      keys.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [settings.keyBindings]);

  // High performance game ref mapping
  const engineRef = useRef<GameEngineState>({
    playerX: 0,
    playerZ: 0,
    playerDirX: 0,
    playerDirZ: 1,
    playerAction: 'idle',
    actionTimer: 0,
    score: 0,
    lives: 5,
    level: 1,
    hasShield: false,
    isGameOver: false,
    enemies: [],
    grasses: [],
    collectibles: [],
    particles: [],
    damageTexts: [],
    danceSkillRadius: 0,
    isDanceSkillActive: false,
    distanceToTemple: 1000,
    enemiesDefeatedCount: 0,
    boss: null,
    fireballs: [],
    warpPortal: null,
    isGameWon: false,
    enemySpawnTimer: 2.0
  });

  const handleStateUpdate = (
    score: number,
    lives: number,
    hasShield: boolean,
    level: number,
    distance: number,
    gameOver: boolean,
    gameWon: boolean
  ) => {
    setHudScore(score);
    setHudLives(lives);
    setHudShield(hasShield);
    setHudLevel(level);
    setHudDistance(distance);
    
    if (gameOver && !isGameOver) {
      setIsGameOver(true);
      if (score > highScore) {
        onNewHighScore(score);
      }
    }

    if (gameWon && !isGameWon) {
      setIsGameWon(true);
      if (score > highScore) {
        onNewHighScore(score);
      }
    }
  };

  const handleRestart = () => {
    soundManager.playMenuSelect();
    
    // Reset React UI parameters
    setHudScore(0);
    setHudLives(5);
    setHudShield(false);
    setHudLevel(1);
    setHudDistance(1000);
    setIsGameOver(false);
    setIsGameWon(false);
    setIsPaused(false);

    // Reset ThreeJS Engine state parameters
    engineRef.current.playerX = 0;
    engineRef.current.playerZ = 0;
    engineRef.current.playerAction = 'idle';
    engineRef.current.actionTimer = 0;
    engineRef.current.score = 0;
    engineRef.current.lives = 5;
    engineRef.current.level = 1;
    engineRef.current.hasShield = false;
    engineRef.current.isGameOver = false;
    engineRef.current.distanceToTemple = 1000;
    engineRef.current.isDanceSkillActive = false;
    engineRef.current.danceSkillRadius = 0;
    engineRef.current.enemies = [];
    engineRef.current.grasses = [];
    engineRef.current.collectibles = [];
    engineRef.current.particles = [];
    engineRef.current.damageTexts = [];
    engineRef.current.enemiesDefeatedCount = 0;
    engineRef.current.boss = null;
    engineRef.current.fireballs = [];
    engineRef.current.warpPortal = null;
    engineRef.current.isGameWon = false;
    engineRef.current.enemySpawnTimer = 2.0;

    // Spawn grasses spread across the map
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 46;
      const z = (Math.random() - 0.5) * 46;
      engineRef.current.grasses.push({
        id: Math.random(),
        x,
        z,
        scaleY: 1.0,
        targetScaleY: 1.0,
        size: 0.8 + Math.random() * 0.4
      });
    }
  };

  // Human controls labels mapper
  const getBindingLabel = (key: string) => {
    if (key === ' ') return 'Space';
    if (key === 'ArrowUp') return '▲';
    if (key === 'ArrowDown') return '▼';
    if (key === 'ArrowLeft') return '◀';
    if (key === 'ArrowRight') return '▶';
    return key.toUpperCase();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-sans select-none" id="game-arena-wrapper">
      
      {/* HUD Header stats overlay */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-3 bg-neutral-900/60 backdrop-blur border border-amber-600/20 px-4 py-2.5 rounded-2xl shadow-lg">
        
        {/* Left Side: Game Level */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] text-amber-500/80 uppercase tracking-widest font-bold">ด่านด่านซ้าย</span>
            <span className="text-lg font-extrabold font-kanit text-white flex items-center gap-1.5">
              🎭 Level {hudLevel}
            </span>
          </div>
          
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            settings.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
            settings.difficulty === 'normal' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {settings.difficulty === 'easy' ? 'ง่าย' : settings.difficulty === 'normal' ? 'ปกติ' : 'ท้าทาย'}
          </span>
        </div>

        {/* Center: Lives counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.max(0, hudLives) }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: i * 0.05 }}
                className="text-red-500 text-xl"
              >
                ❤️
              </motion.span>
            ))}
            {hudLives === 0 && <span className="text-xs text-neutral-500 font-kanit">หมดชีวิต</span>}
          </div>

          {/* Shield active state indicator */}
          {hudShield && (
            <div className="flex items-center gap-1 text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2 py-1 rounded-md text-[11px] font-bold animate-pulse">
              <Shield className="w-3.5 h-3.5" /> บาเรียน้ำมนต์
            </div>
          )}
        </div>

        {/* Right Side: Score systems */}
        <div className="flex gap-4 items-center">
          <div className="text-right">
            <div className="text-[10px] text-neutral-400 font-kanit">คะแนนสูงสุด</div>
            <div className="font-mono text-xs text-amber-400 font-bold">{Math.max(highScore, hudScore)}</div>
          </div>
          <div className="text-right border-l border-neutral-800 pl-4">
            <div className="text-[10px] text-neutral-400 font-kanit">คะแนนปัจุบัน</div>
            <div className="font-mono text-xl text-emerald-400 font-bold">{hudScore}</div>
          </div>
        </div>

      </div>

      {/* Progress towards Temple Gate */}
      <div className="w-full max-w-4xl bg-neutral-900/40 border border-neutral-800 rounded-lg p-2.5 mb-3">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
          <span className="font-kanit">🏃‍♂️ วิ่งกวาดล้างวิญญาณป่าช้าด่านซ้าย</span>
          <span className="font-kanit text-amber-500">🛕 ปลายทาง: วิหารวัดโพนชัย ({Math.max(0, Math.round(hudDistance))}m)</span>
        </div>
        <div className="w-full bg-neutral-950 h-2.5 rounded-full overflow-hidden border border-neutral-800 p-[1.5px]">
          <div 
            className="h-full bg-gradient-to-r from-amber-600 via-yellow-500 to-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, ((1000 - hudDistance) / 1000) * 100))}%` }}
          />
        </div>
      </div>

      {/* R3F Canvas Stage */}
      <div 
        className="w-full max-w-4xl relative bg-neutral-950 rounded-2xl overflow-hidden border-2 border-amber-600/40 shadow-2xl h-[420px]"
        id="game-canvas-container"
      >
        <Suspense fallback={<GameLoader />}>
          <Canvas shadows camera={{ position: [0, 11, 12], fov: 45 }}>
            <Scene3D
              settings={settings}
              engine={engineRef}
              keys={keys}
              onStateUpdate={handleStateUpdate}
              isPaused={isPaused}
            />
          </Canvas>
        </Suspense>

        {/* Game Over Panel Overlay */}
        <AnimatePresence>
          {isGameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20"
            >
              <span className="text-6xl animate-bounce">👹</span>
              <h2 className="text-4xl font-extrabold font-kanit text-red-500 tracking-wide">
                การผจญภัยสิ้นสุดลง!
              </h2>
              
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 w-72 text-center shadow-lg my-2">
                <div className="text-xs text-neutral-400 uppercase tracking-widest mb-1 font-mono">คะแนนที่คุณทำได้</div>
                <div className="text-4xl font-black text-amber-400 font-mono mb-3">{hudScore}</div>
                {hudScore >= highScore && hudScore > 0 && (
                  <div className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 py-1 px-2 rounded-full inline-block animate-pulse">
                    🏆 คะแนนสูงสุดใหม่ (NEW HIGH SCORE!)
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition shadow-lg shadow-amber-500/10 cursor-pointer"
                  id="restart-game-btn"
                >
                  <RotateCcw className="w-4 h-4" /> เล่นอีกครั้ง (Retry)
                </button>
                <button
                  onClick={onBackToMenu}
                  className="flex items-center gap-2 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition border border-neutral-700 cursor-pointer"
                  id="menu-game-btn"
                >
                  <Home className="w-4 h-4" /> เมนูหลัก (Menu)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause Panel Overlay */}
        <AnimatePresence>
          {isPaused && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20"
            >
              <span className="text-6xl animate-bounce">⏸️</span>
              <h2 className="text-4xl font-extrabold font-kanit text-amber-500 tracking-wide">
                เกมหยุดชั่วคราว (PAUSED)
              </h2>
              <p className="text-sm text-neutral-400 font-kanit">กดปุ่ม ESC หรือปุ่มด้านล่างเพื่อเล่นต่อ</p>
              
              <div className="flex gap-4 mt-2">
                <button
                  onClick={() => {
                    soundManager.playMenuSelect();
                    setIsPaused(false);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition shadow-lg shadow-amber-500/10 cursor-pointer font-kanit text-sm"
                  id="resume-btn"
                >
                  ▶ เล่นต่อ (Resume)
                </button>
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition border border-neutral-700 cursor-pointer font-kanit text-sm"
                  id="pause-restart-btn"
                >
                  <RotateCcw className="w-4 h-4" /> เริ่มใหม่ (Restart)
                </button>
                <button
                  onClick={onBackToMenu}
                  className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 font-bold rounded-xl transition border border-neutral-800 cursor-pointer font-kanit text-sm"
                  id="pause-menu-btn"
                >
                  <Home className="w-4 h-4" /> เมนูหลัก (Menu)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Won / Ending Panel Overlay */}
        <AnimatePresence>
          {isGameWon && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-20"
            >
              <span className="text-7xl animate-pulse">🌌✨🏆</span>
              <h2 className="text-4xl font-extrabold font-kanit text-emerald-400 tracking-wide text-center">
                ขอแสดงความยินดี! คุณทำสำเร็จ!
              </h2>
              
              <div className="bg-neutral-900 border-2 border-emerald-500/20 rounded-2xl p-6 w-96 text-center shadow-2xl my-2">
                <p className="text-sm text-emerald-300 font-kanit mb-4 leading-relaxed">
                  "คุณสามารถปราบพญาบอสพิทักษ์และปัดเป่าดวงวิญญาณร้ายได้ทั้งหมด! พิธีกรรมโบราณสำเร็จเสร็จสิ้น หมู่บ้านด่านซ้ายและวัดโพนชัยกลับคืนสู่ความร่มเย็นเป็นสุขสืบไป"
                </p>
                <div className="border-t border-neutral-800 pt-3 flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span className="font-kanit">ระดับความยาก</span>
                    <span className="font-bold text-amber-400">
                      {settings.difficulty === 'easy' ? 'ง่าย' : settings.difficulty === 'normal' ? 'ปกติ' : 'ท้าทาย'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span className="font-kanit">คะแนนรวมที่ทำได้</span>
                    <span className="font-mono font-bold text-emerald-400 text-lg">{hudScore}</span>
                  </div>
                  {hudScore >= highScore && hudScore > 0 && (
                    <div className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 py-1 rounded-full text-center animate-pulse mt-1">
                      🏆 คะแนนสูงสุดใหม่ (NEW HIGH SCORE!)
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                  id="won-restart-btn"
                >
                  <RotateCcw className="w-4 h-4" /> เล่นใหม่อีกครั้ง (Play Again)
                </button>
                <button
                  onClick={onBackToMenu}
                  className="flex items-center gap-2 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition border border-neutral-700 cursor-pointer animate-pulse"
                  id="won-menu-btn"
                >
                  <Home className="w-4 h-4" /> กลับหน้าเมนูหลัก (Back to Menu)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Instruction Panel */}
      <div className="w-full max-w-4xl mt-3 flex flex-wrap items-center justify-between gap-3 bg-neutral-900/30 px-4 py-3 rounded-2xl border border-neutral-800">
        
        {/* Reset/Back Menu controls */}
        <div className="flex gap-2">
          <button
            onClick={onBackToMenu}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition cursor-pointer"
            id="pause-toggle-button"
          >
            <span>🏠</span> กลับเมนูหลัก
          </button>
          <button
            onClick={() => {
              soundManager.playMenuSelect();
              setIsPaused(prev => !prev);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/35 text-amber-400 border border-amber-500/20 rounded-lg transition cursor-pointer font-kanit"
            id="pause-button-toggle"
          >
            <span>⏸️</span> {isPaused ? 'เล่นต่อ' : 'หยุดเกม'} (ESC)
          </button>
        </div>

        {/* Dynamic Display of bindings & manual trigger info */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <span className="bg-neutral-950 border border-amber-600/30 text-amber-500 px-2 py-0.5 rounded font-bold font-mono min-w-[32px] text-center">
              W,A,S,D
            </span>
            <span className="font-kanit">บังคับเดิน 8 ทิศทาง</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="bg-neutral-950 border border-amber-600/30 text-amber-500 px-2 py-0.5 rounded font-bold font-mono min-w-[32px] text-center">
              P
            </span>
            <span className="font-kanit">โจมตี/ต่อย (Row 3)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="bg-neutral-950 border border-amber-600/30 text-amber-500 px-2 py-0.5 rounded font-bold font-mono min-w-[32px] text-center">
              O
            </span>
            <span className="font-kanit">เต้นสร้าง Skill (Row 4)</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-sans">
          <Info className="w-3.5 h-3.5" /> เคล็ดลับ: เต้นฟอกจิตเพื่อกวาดล้างศัตรูวงกว้าง!
        </div>

      </div>

      {/* Visual Controls for Touch Screens & Mouse Clicks */}
      <div className="w-full max-w-4xl mt-3 bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <span className="text-xs text-neutral-400 font-sans">
          🎮 แผงควบคุมเสมือน (ทัชสกรีน / คลิกเมาส์):
        </span>
        <div className="flex flex-wrap items-center justify-center gap-3">
          
          {/* Movement Directions */}
          <div className="flex items-center gap-1.5 bg-neutral-900/60 p-1.5 rounded-xl border border-neutral-800">
            <button
              onMouseDown={() => { keys.current['a'] = true; }}
              onMouseUp={() => { keys.current['a'] = false; }}
              onTouchStart={(e) => { e.preventDefault(); keys.current['a'] = true; }}
              onTouchEnd={() => { keys.current['a'] = false; }}
              className="w-12 h-10 bg-neutral-950 active:bg-amber-600/30 rounded-lg flex items-center justify-center text-xs font-bold"
            >
              ◀ ซ้าย
            </button>
            <div className="flex flex-col gap-1.5">
              <button
                onMouseDown={() => { keys.current['w'] = true; }}
                onMouseUp={() => { keys.current['w'] = false; }}
                onTouchStart={(e) => { e.preventDefault(); keys.current['w'] = true; }}
                onTouchEnd={() => { keys.current['w'] = false; }}
                className="w-12 h-10 bg-neutral-950 active:bg-amber-600/30 rounded-lg flex items-center justify-center text-xs font-bold"
              >
                ▲ ขึ้น
              </button>
              <button
                onMouseDown={() => { keys.current['s'] = true; }}
                onMouseUp={() => { keys.current['s'] = false; }}
                onTouchStart={(e) => { e.preventDefault(); keys.current['s'] = true; }}
                onTouchEnd={() => { keys.current['s'] = false; }}
                className="w-12 h-10 bg-neutral-950 active:bg-amber-600/30 rounded-lg flex items-center justify-center text-xs font-bold"
              >
                ▼ ลง
              </button>
            </div>
            <button
              onMouseDown={() => { keys.current['d'] = true; }}
              onMouseUp={() => { keys.current['d'] = false; }}
              onTouchStart={(e) => { e.preventDefault(); keys.current['d'] = true; }}
              onTouchEnd={() => { keys.current['d'] = false; }}
              className="w-12 h-10 bg-neutral-950 active:bg-amber-600/30 rounded-lg flex items-center justify-center text-xs font-bold"
            >
              ขวา ▶
            </button>
          </div>

          {/* Action keys */}
          <div className="flex items-center gap-2">
            <button
              onMouseDown={() => { keys.current['p'] = true; }}
              onMouseUp={() => { keys.current['p'] = false; }}
              onTouchStart={(e) => { e.preventDefault(); keys.current['p'] = true; }}
              onTouchEnd={() => { keys.current['p'] = false; }}
              className="w-20 h-12 bg-red-600 text-white font-extrabold rounded-xl flex items-center justify-center text-sm cursor-pointer hover:bg-red-500"
              id="mobile-btn-punch"
            >
              🥊 โจมตี (P)
            </button>

            <button
              onMouseDown={() => { keys.current['o'] = true; }}
              onMouseUp={() => { keys.current['o'] = false; }}
              onTouchStart={(e) => { e.preventDefault(); keys.current['o'] = true; }}
              onTouchEnd={() => { keys.current['o'] = false; }}
              className="w-24 h-12 bg-purple-600 text-white font-extrabold rounded-xl flex items-center justify-center text-xs cursor-pointer hover:bg-purple-500 shadow-lg shadow-purple-500/20"
              id="mobile-btn-dance"
            >
              💃 สกิลเต้น (O)
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
