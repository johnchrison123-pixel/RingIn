/* eslint-disable */
import {createClient} from '@supabase/supabase-js';
export var sb = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
