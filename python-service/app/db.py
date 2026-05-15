"""Supabase client wrapper for the Python service."""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or SUPABASE_ANON_KEY


def get_client() -> Client:
    """Return a Supabase client using anon key (respects RLS)."""
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def get_admin_client() -> Client:
    """Return a Supabase client using service key (bypasses RLS).
    Used for analytics/admin operations only.
    """
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
