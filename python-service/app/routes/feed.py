"""
Personalized feed ranking — orders posts by relevance to a user.
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.db import get_client

router = APIRouter()


def hours_since(iso_string):
    """Return hours since timestamp. Returns 0 for future dates (clock skew) or 9999 if parsing fails."""
    if not iso_string:
        return 9999
    try:
        dt = datetime.fromisoformat(str(iso_string).replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - dt
        hours = delta.total_seconds() / 3600
        return max(0.0, hours)  # Guard against future timestamps causing infinite recency
    except Exception:
        return 9999


@router.get("/personalized/{user_id}")
async def personalized_feed(user_id: str, limit: int = 20):
    """
    Return posts ranked by personalized relevance score:
    - Posts from followed users (high boost)
    - Recent posts (recency boost, half-life ~24h)
    - High-engagement posts (likes + comments)
    - Posts matching user's interests (tag overlap)
    - Posts from same geography (small boost)
    """
    sb = get_client()

    try:
        # Get user profile
        user_resp = sb.table("profiles").select("*").eq("id", user_id).single().execute()
        if not user_resp.data:
            raise HTTPException(status_code=404, detail="User not found")

        user = user_resp.data
        user_bio = {}
        try:
            user_bio = json.loads(user.get("bio") or "{}")
        except Exception:
            pass
        user_loc = user_bio.get("location", {})

        # Get user interests from bio + tag
        user_interests = set()
        if user_bio.get("tag"):
            user_interests.add(user_bio["tag"].replace("#", "").lower())
        for w in (user_bio.get("about") or "").lower().split():
            if len(w) > 4:
                user_interests.add(w)

        # Get followed user IDs
        follows_resp = sb.table("follows").select("following_id").eq("follower_id", user_id).execute()
        following_ids = set(r["following_id"] for r in (follows_resp.data or []))

        # Get muted post IDs to exclude
        muted_resp = sb.table("muted_posts").select("post_id").eq("user_id", user_id).execute()
        muted_ids = set(r["post_id"] for r in (muted_resp.data or []))

        # Get recent posts (last 100)
        posts_resp = sb.table("posts").select("*").order("created_at", desc=True).limit(100).execute()
        posts = posts_resp.data or []

        # Filter out muted
        posts = [p for p in posts if p["id"] not in muted_ids]

        # Get authors' locations in one query
        author_ids = list(set(p["user_id"] for p in posts if p.get("user_id")))
        authors_resp = sb.table("profiles").select("id, bio").in_("id", author_ids).execute()
        author_loc_map = {}
        for a in (authors_resp.data or []):
            try:
                ab = json.loads(a.get("bio") or "{}")
                author_loc_map[a["id"]] = ab.get("location", {})
            except Exception:
                author_loc_map[a["id"]] = {}

        # Score each post
        scored = []
        for p in posts:
            score = 0.0
            reasons = []

            # 1. Follower boost
            if p["user_id"] in following_ids:
                score += 10.0
                reasons.append("from_followed")

            # 2. Recency (exponential decay, half-life 24h)
            hours = hours_since(p.get("created_at", ""))
            recency_score = 10.0 * (0.5 ** (hours / 24.0))
            score += recency_score

            # 3. Engagement
            likes = len(p.get("likes") or []) if isinstance(p.get("likes"), list) else 0
            comments = p.get("comments_count") or 0
            engagement = (likes * 0.5) + (comments * 1.5)
            # Cap engagement score to prevent spam-likes from dominating
            score += min(engagement / 5.0, 8.0)

            # 4. Tag/interest overlap
            tags = p.get("tags") or []
            tag_set = set(t.lower() for t in tags)
            text_words = set(w for w in (p.get("text") or "").lower().split() if len(w) > 4)
            overlap = (user_interests & (tag_set | text_words))
            if overlap:
                score += len(overlap) * 1.0
                reasons.append(f"matches_interests:{','.join(list(overlap)[:3])}")

            # 5. Geography boost
            author_loc = author_loc_map.get(p["user_id"], {})
            if user_loc.get("country") and user_loc["country"] == author_loc.get("country"):
                score += 0.5
            if user_loc.get("city") and user_loc["city"] == author_loc.get("city"):
                score += 1.0
                reasons.append("local")

            scored.append({
                "post": p,
                "score": round(score, 2),
                "reasons": reasons,
            })

        # Sort by score descending
        scored.sort(key=lambda x: x["score"], reverse=True)
        top = scored[:limit]

        return {
            "user_id": user_id,
            "count": len(top),
            "feed": [
                {
                    "id": s["post"]["id"],
                    "user_id": s["post"]["user_id"],
                    "user_name": s["post"].get("user_name"),
                    "user_avatar": s["post"].get("user_avatar"),
                    "text": s["post"].get("text"),
                    "images": s["post"].get("images"),
                    "tags": s["post"].get("tags"),
                    "created_at": s["post"].get("created_at"),
                    "comments_count": s["post"].get("comments_count"),
                    "likes_count": len(s["post"].get("likes") or []) if isinstance(s["post"].get("likes"), list) else 0,
                    "score": s["score"],
                    "ranking_reasons": s["reasons"],
                }
                for s in top
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
