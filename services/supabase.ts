
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://reyfxiecqhyqxmszxvnn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJleWZ4aWVjcWh5cXhtc3p4dm5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzEyMzYsImV4cCI6MjA4Mjk0NzIzNn0.W0LyLtOrAWKMlbjsaUd3aYikJJ-RGTvI_oP5glJUpd8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
