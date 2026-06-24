import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://juqvvdnybhwelctlhdlr.supabase.co'
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXZ2ZG55Ymh3ZWxjdGxoZGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzYxMTcsImV4cCI6MjA5MjkxMjExN30.3sddN3zuQvwnUHzO4yUpQVnIA07qY6H23PfeHTau0fg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
