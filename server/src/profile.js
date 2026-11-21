import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, USER_HOME } from './config.js';

export const PROFILE_PATH = path.join(USER_HOME, 'profile.json');
export const AVATAR_DIR = path.join(DATA_DIR, 'avatars');

const DEFAULT_PROFILE = {
  username: 'developer',
  nickname: '',
  bio: '',
  avatarFile: '',
  locale: 'zh-CN',
  theme: 'dark',
  city: '厦门',
  weatherAutoLocate: true,
  weatherLat: null,
  weatherLon: null,
};

export function ensureProfile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PROFILE_PATH)) {
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(DEFAULT_PROFILE, null, 2), 'utf8');
  }
}

export function loadProfile() {
  ensureProfile();
  const merged = { ...DEFAULT_PROFILE, ...JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8')) };
  if (!String(merged.city ?? '').trim()) {
    merged.city = DEFAULT_PROFILE.city;
  }
  return merged;
}

export function saveProfile(patch) {
  ensureProfile();
  const next = { ...loadProfile(), ...patch };
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function saveAvatarFromDataUrl(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new Error('invalid image data');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw new Error('image too large (max 2MB)');
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  const filename = `avatar.${ext}`;
  const abs = path.join(AVATAR_DIR, filename);
  fs.writeFileSync(abs, buf);
  saveProfile({ avatarFile: filename });
  return filename;
}

export function avatarAbsPath(filename) {
  if (!filename) return null;
  const safe = path.basename(filename);
  const abs = path.join(AVATAR_DIR, safe);
  return fs.existsSync(abs) ? abs : null;
}