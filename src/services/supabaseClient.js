import { createClient } from '@supabase/supabase-js';

// Accessing Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY;

// Check if variables exist before initializing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not found in environment variables. Falling back to empty strings to prevent crash.");
}

// We use the || "" to ensure the client doesn't throw a "required" error immediately
export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");