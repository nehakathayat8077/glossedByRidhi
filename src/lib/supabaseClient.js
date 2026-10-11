import { createClient } from '@supabase/supabase-js';

const configuredUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://uqanejmosujpldxepmnl.supabase.co';
const projectUrl = configuredUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!anonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY must be set to load Supabase data.');
}

export const supabase = createClient(projectUrl, anonKey);
