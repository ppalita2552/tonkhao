/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CharacterPreset } from '../types';

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'classic-red',
    name: 'แดงสุริยะ (Solar Red)',
    color: '#ef4444', // Red
    secondaryColor: '#eab308', // Yellow
    description: 'หน้ากากสีแดงเพลิงดั้งเดิมจากอำเภอด่านซ้าย คล่องแคล่วว่องไวระดับมาตรฐาน',
    speedMultiplier: 1.0,
  },
  {
    id: 'forest-green',
    name: 'เขียวภูหลวง (Mountain Green)',
    color: '#22c55e', // Green
    secondaryColor: '#f97316', // Orange
    description: 'ลวดลายธรรมชาติพฤกษาแห่งเลย ได้รับพรแห่งป่าลึกเพิ่มความอึดและการฟื้นตัว',
    speedMultiplier: 0.9,
  },
  {
    id: 'golden-sun',
    name: 'ทองคำสยาม (Siam Gold)',
    color: '#eab308', // Gold
    secondaryColor: '#3b82f6', // Blue
    description: 'หน้ากากทองอร่ามศักดิ์สิทธิ์ที่ใช้เปิดเทศกาล มีความเร็วสูงสุด ท้าทายทุกสิ่งกีดขวาง',
    speedMultiplier: 1.15,
  },
  {
    id: 'indigo-spirit',
    name: 'ครามอัสนี (Thunder Indigo)',
    color: '#6366f1', // Indigo
    secondaryColor: '#ec4899', // Pink
    description: 'ย้อมด้วยสีครามธรรมชาติจากฝีมือชาวบ้านด่านซ้าย ให้พลังการควบคุมที่แม่นยำดั่งใจนึก',
    speedMultiplier: 1.05,
  }
];
