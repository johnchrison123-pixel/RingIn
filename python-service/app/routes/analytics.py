"""
Admin analytics endpoints.
Provides KPIs, retention, growth metrics.
"""
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Header, HTTPException
from typing import Optional
from app.db import get_client

router = APIRouter()

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "change-me")


def check_admin(x_admin_key: Optional[str]):
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/overview")
async def overview(x_admin_key: Optional[str] = Header(None)):
    """Get high-level metrics for the admin dashboard."""
    check_admin(x_admin_key)
    sb = get_client()

    try:
        # Total users
        users_resp = sb.table("profiles").select("id", count="exact").execute()
        total_users = users_resp.count or 0

        # Online now
        online_resp = sb.table("profiles").select("id", count="exact").eq("is_online", True).execute()
        online_now = online_resp.count or 0

        # Posts (total + last 24h)
        posts_resp = sb.table("posts").select("id", count="exact").execute()
        total_posts = posts_resp.count or 0

        yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        new_posts_resp = sb.table("posts").select("id", count="exact").gte("created_at", yesterday).execute()
        new_posts_24h = new_posts_resp.count or 0

        # Comments
        comments_resp = sb.table("comments").select("id", count="exact").execute()
        total_comments = comments_resp.count or 0

        # Messages
        msgs_resp = sb.table("messages").select("id", count="exact").execute()
        total_messages = msgs_resp.count or 0

        new_msgs_resp = sb.table("messages").select("id", count="exact").gte("created_at", yesterday).execute()
        new_messages_24h = new_msgs_resp.count or 0

        # New users last 7 days
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        new_users_resp = sb.table("profiles").select("id", count="exact").gte("created_at", week_ago).execute()
        new_users_week = new_users_resp.count or 0

        return {
            "users": {
                "total": total_users,
                "online_now": online_now,
                "new_last_7d": new_users_week,
            },
            "content": {
                "total_posts": total_posts,
                "new_posts_24h": new_posts_24h,
                "total_comments": total_comments,
            },
            "engagement": {
                "total_messages": total_messages,
                "new_messages_24h": new_messages_24h,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily-active")
async def daily_active(days: int = 14, x_admin_key: Optional[str] = Header(None)):
    """Daily active users over the last N days."""
    check_admin(x_admin_key)
    sb = get_client()

    try:
        results = []
        for i in range(days):
            day_end = datetime.now(timezone.utc) - timedelta(days=i)
            day_start = day_end - timedelta(days=1)

            # Users active = posted, commented, or sent a message that day
            posters = sb.table("posts").select("user_id").gte("created_at", day_start.isoformat()).lt("created_at", day_end.isoformat()).execute()
            commenters = sb.table("comments").select("user_id").gte("created_at", day_start.isoformat()).lt("created_at", day_end.isoformat()).execute()
            senders = sb.table("messages").select("sender_id").gte("created_at", day_start.isoformat()).lt("created_at", day_end.isoformat()).execute()

            active_ids = set()
            for r in (posters.data or []):
                if r.get("user_id"): active_ids.add(r["user_id"])
            for r in (commenters.data or []):
                if r.get("user_id"): active_ids.add(r["user_id"])
            for r in (senders.data or []):
                if r.get("sender_id"): active_ids.add(r["sender_id"])

            results.append({
                "date": day_start.date().isoformat(),
                "active_users": len(active_ids),
                "posts": len(posters.data or []),
                "comments": len(commenters.data or []),
                "messages": len(senders.data or []),
            })

        return {"days": list(reversed(results))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/top-users")
async def top_users(by: str = "posts", limit: int = 10, x_admin_key: Optional[str] = Header(None)):
    """Top users by posts/followers/engagement."""
    check_admin(x_admin_key)
    sb = get_client()

    try:
        if by == "posts":
            # Get post counts
            posts_resp = sb.table("posts").select("user_id, user_name").execute()
            counts = {}
            for p in (posts_resp.data or []):
                uid = p.get("user_id")
                if uid:
                    if uid not in counts:
                        counts[uid] = {"user_id": uid, "name": p.get("user_name", "User"), "count": 0}
                    counts[uid]["count"] += 1
            top = sorted(counts.values(), key=lambda x: x["count"], reverse=True)[:limit]
            return {"by": "posts", "top": top}

        elif by == "followers":
            follows_resp = sb.table("follows").select("following_id, following_name").execute()
            counts = {}
            for f in (follows_resp.data or []):
                fid = f.get("following_id")
                if fid:
                    if fid not in counts:
                        counts[fid] = {"user_id": fid, "name": f.get("following_name", "User"), "count": 0}
                    counts[fid]["count"] += 1
            top = sorted(counts.values(), key=lambda x: x["count"], reverse=True)[:limit]
            return {"by": "followers", "top": top}

        else:
            raise HTTPException(status_code=400, detail="Invalid 'by' parameter")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/geography")
async def geography(x_admin_key: Optional[str] = Header(None)):
    """User distribution by country / state / city."""
    check_admin(x_admin_key)
    sb = get_client()

    try:
        import json as json_lib
        users_resp = sb.table("profiles").select("bio").execute()
        countries = {}
        states = {}
        cities = {}
        for u in (users_resp.data or []):
            try:
                bio = json_lib.loads(u.get("bio") or "{}")
                loc = bio.get("location") or {}
                c = loc.get("country_name") or loc.get("country")
                s = loc.get("state")
                city = loc.get("city")
                if c:
                    countries[c] = countries.get(c, 0) + 1
                if s:
                    states[s] = states.get(s, 0) + 1
                if city:
                    cities[city] = cities.get(city, 0) + 1
            except Exception:
                continue

        return {
            "countries": sorted([{"name": k, "count": v} for k, v in countries.items()], key=lambda x: -x["count"]),
            "states": sorted([{"name": k, "count": v} for k, v in states.items()], key=lambda x: -x["count"])[:20],
            "cities": sorted([{"name": k, "count": v} for k, v in cities.items()], key=lambda x: -x["count"])[:30],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/funnel")
async def funnel(x_admin_key: Optional[str] = Header(None)):
    """Conversion funnel: signed up → posted → followed → messaged → called."""
    check_admin(x_admin_key)
    sb = get_client()

    try:
        users_resp = sb.table("profiles").select("id", count="exact").execute()
        total = users_resp.count or 0

        # Distinct users who posted
        posters = sb.table("posts").select("user_id").execute()
        posted = len(set(p["user_id"] for p in (posters.data or []) if p.get("user_id")))

        # Distinct users who followed someone
        follows = sb.table("follows").select("follower_id").execute()
        followed = len(set(f["follower_id"] for f in (follows.data or []) if f.get("follower_id")))

        # Distinct users who sent a message
        msgs = sb.table("messages").select("sender_id").execute()
        messaged = len(set(m["sender_id"] for m in (msgs.data or []) if m.get("sender_id")))

        # Users who made transactions (=called/paid)
        try:
            tx = sb.table("transactions").select("user_id").execute()
            called = len(set(t["user_id"] for t in (tx.data or []) if t.get("user_id")))
        except Exception:
            called = 0

        return {
            "funnel": [
                {"step": "signed_up", "users": total, "pct": 100.0},
                {"step": "posted_first", "users": posted, "pct": round(100 * posted / max(total, 1), 1)},
                {"step": "followed_someone", "users": followed, "pct": round(100 * followed / max(total, 1), 1)},
                {"step": "sent_message", "users": messaged, "pct": round(100 * messaged / max(total, 1), 1)},
                {"step": "made_transaction", "users": called, "pct": round(100 * called / max(total, 1), 1)},
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
