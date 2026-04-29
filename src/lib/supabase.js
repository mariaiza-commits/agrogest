import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://juqvvdnybhwelctlhdlr.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Su9Dy3TOVaeYZuiLK1Uerg_nrSUXgCb'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
