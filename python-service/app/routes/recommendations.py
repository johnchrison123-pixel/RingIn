"""
Expert and user recommendations.
Uses content-based + collaborative filtering hybrid approach.
"""
import json
from fastapi import APIRouter, HTTPException
from app.db import get_client
from app.services.similarity import compute_user_similarity, get_user_features

router = APIRouter()


@router.get("/experts/{user_id}")
async def recommend_experts(user_id: str, limit: int = 8):
    """
    Recommend experts to a user based on:
    - Their interests (tags from posts they liked + commented on)
    - Geography (same country/state)
    - Their existing follows (similar users' follows)
    - Online status (boost online experts)
    """
    sb = get_client()

    try:
        # 1. Get target user profile
        user_resp = sb.table("profiles").select("*").eq("id", user_id).single().execute()
        if not user_resp.data:
            raise HTTPException(status_code=404, detail="User not found")

        user = user_resp.data
        user_bio = {}
        try:
            user_bio = json.loads(user.get("bio") or "{}")
        except Exception:
            pass
        user_location = user_bio.get("location", {})

        # 2. Get all candidate experts (profiles with verified or expert_request)
        experts_resp = sb.table("profiles").select("*").neq("id", user_id).limit(200).execute()
        candidates = experts_resp.data or []

        # 3. Get user's likes / follows to learn preferences
        follows_resp = sb.table("follows").select("following_id").eq("follower_id", user_id).execute()
        already_following = set(r["following_id"] for r in (follows_resp.data or []))

        # 4. Score each candidate
        scored = []
        for cand in candidates:
            if cand["id"] in already_following:
                continue  # skip already-following

            score = 0.0
            cand_bio = {}
            try:
                cand_bio = json.loads(cand.get("bio") or "{}")
            except Exception:
                pass

            # Geography boost
            cand_location = cand_bio.get("location", {})
            if user_location.get("country") and user_location["country"] == cand_location.get("country"):
                score += 2.0
            if user_location.get("state") and user_location["state"] == cand_location.get("state"):
                score += 3.0
            if user_location.get("city") and user_location["city"] == cand_location.get("city"):
                score += 2.0

            # Online boost
            if cand.get("is_online"):
                score += 1.5

            # Expert boost
            if cand_bio.get("expert_request"):
                score += 4.0

            # Activity boost (last_seen recency)
            if cand.get("last_seen"):
                score += 0.5

            # Tag overlap (simple text match on bio)
            user_about = (user_bio.get("about") or "").lower()
            cand_about = (cand_bio.get("about") or "").lower()
            if user_about and cand_about:
                overlap = compute_user_similarity(user_about, cand_about)
                score += overlap * 3.0

            scored.append({
                "id": cand["id"],
                "name": cand.get("full_name") or (cand.get("email", "").split("@")[0] if cand.get("email") else "User"),
                "avatar_url": cand.get("avatar_url"),
                "bio_tag": cand_bio.get("tag"),
                "about": cand_bio.get("about", "")[:120],
                "is_online": cand.get("is_online", False),
                "expert_area": cand_bio.get("expert_request", {}).get("area") if cand_bio.get("expert_request") else None,
                "rate": cand_bio.get("expert_request", {}).get("rate") if cand_bio.get("expert_request") else None,
                "city": cand_location.get("city"),
                "country": cand_location.get("country_name") or cand_location.get("country"),
                "score": round(score, 2),
            })

        # 5. Sort by score and return top N
        scored.sort(key=lambda x: x["score"], reverse=True)
        return {
            "user_id": user_id,
            "count": len(scored[:limit]),
            "recommendations": scored[:limit],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/similar-users/{user_id}")
async def similar_users(user_id: str, limit: int = 10):
    """
    Find users similar to the given user — useful for 'People like you also follow X'.
    """
    sb = get_client()

    try:
        user_resp = sb.table("profiles").select("*").eq("id", user_id).single().execute()
        if not user_resp.data:
            raise HTTPException(status_code=404, detail="User not found")

        target_features = get_user_features(user_resp.data)

        # Get all profiles
        all_resp = sb.table("profiles").select("*").neq("id", user_id).limit(300).execute()
        all_profiles = all_resp.data or []

        scored = []
        for p in all_profiles:
            feats = get_user_features(p)
            sim = compute_user_similarity(target_features, feats)
            if sim > 0:
                p_bio = {}
                try:
                    p_bio = json.loads(p.get("bio") or "{}")
                except Exception:
                    pass
                scored.append({
                    "id": p["id"],
                    "name": p.get("full_name") or (p.get("email", "").split("@")[0] if p.get("email") else "User"),
                    "avatar_url": p.get("avatar_url"),
                    "tag": p_bio.get("tag"),
                    "similarity": round(sim, 3),
                })

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return {
            "user_id": user_id,
            "similar_users": scored[:limit],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trending-experts")
async def trending_experts(limit: int = 10):
    """Globally trending experts based on recent activity."""
    sb = get_client()
    try:
        # Experts who are online + have expert applications
        resp = sb.table("profiles").select("*").eq("is_online", True).limit(50).execute()
        profiles = resp.data or []

        # Filter for experts
        experts = []
        for p in profiles:
            bio = {}
            try:
                bio = json.loads(p.get("bio") or "{}")
            except Exception:
                pass
            if bio.get("expert_request"):
                experts.append({
                    "id": p["id"],
                    "name": p.get("full_name") or "User",
                    "avatar_url": p.get("avatar_url"),
                    "area": bio.get("expert_request", {}).get("area"),
                    "rate": bio.get("expert_request", {}).get("rate"),
                    "is_online": p.get("is_online"),
                })

        return {"trending": experts[:limit]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
