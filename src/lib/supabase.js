import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anon);
export const supabase = configured ? createClient(url, anon) : null;

// Shrink the photo in the browser first: phone photos are 5 MB+, and a
// 1280px JPEG uploads fast and is plenty for Lens and the vision model.
export async function shrinkPhoto(file, maxSide = 1280) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return blob || file;
  } catch {
    return file; // e.g. a format the browser can't decode; upload as is
  }
}

export async function uploadPhoto(file) {
  const blob = await shrinkPhoto(file);
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from('photos')
    .upload(name, blob, { contentType: blob.type || 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from('photos').getPublicUrl(name).data.publicUrl;
}

let rehabCache = null;
export async function loadRehabs() {
  if (rehabCache) return rehabCache;
  const { data, error } = await supabase.from('rehabs').select('*');
  if (error) throw error;
  rehabCache = data;
  return data;
}

const fireCache = new Map();
export async function loadFires(date, { force = false } = {}) {
  const key = date || 'recent';
  if (!force && fireCache.has(key)) return fireCache.get(key);
  const r = await fetch(`/api/fires${date ? `?date=${date}` : ''}`);
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || 'Could not load fire data');
  fireCache.set(key, body.fires);
  return body.fires;
}
