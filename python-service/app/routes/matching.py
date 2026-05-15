"""
Matching engine — pairs users based on geography, interests, and goals.
Used by Anonymous Connect and general user discovery.
"""
import json
import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.db import get_client
from app.services.similarity import jaccard_similarity, compute_text_similarity

router = APIRouter()


class MatchRequest(BaseModel):
    user_id: str
    interests: List[str] = []
    chat_type: Optional[str] = "voice"  # voice | video | text
    same_geography: bool = True
    same_age_range: bool = False
    exclude_user_ids: List[str] = []


@router.post("/anonymous")
async def match_anonymous(req: MatchRequest):
    """
    Match a user with another online user based on shared interests and geography.
    Used by the Anonymous Connect feature.
    """
    sb = get_client()

    try:
        # Get requesting user
        user_resp = sb.table("profiles").select("*").eq("id", req.user_id).single().execute()
        if not user_resp.data:
            raise HTTPException(status_code=404, detail="User not found")

        user = user_resp.data
        user_bio = {}
        try:
            user_bio = json.loads(user.get("bio") or "{}")
        except Exception:
            pass
        user_location = user_bio.get("location", {})

        # Get online candidates
        candidates_resp = sb.table("profiles") \
            .select("*") \
            .eq("is_online", True) \
            .neq("id", req.user_id) \
            .limit(100) \
            .execute()
        candidates = candidates_resp.data or []

        # Filter out excluded users (e.g., already blocked or recently called)
        excluded = set(req.exclude_user_ids)
        candidates = [c for c in candidates if c["id"] not in excluded]

        # Get blocked users to exclude
        blocked_resp = sb.table("blocked_users") \
            .select("blocked_id") \
            .eq("blocker_id", req.user_id) \
            .execute()
        blocked_ids = set(r["blocked_id"] for r in (blocked_resp.data or []))
        candidates = [c for c in candidates if c["id"] not in blocked_ids]

        if not candidates:
            return {"match": None, "reason": "No online users available right now"}

        # Score each candidate
        scored = []
        for cand in candidates:
            cand_bio = {}
            try:
                cand_bio = json.loads(cand.get("bio") or "{}")
            except Exception:
                pass

            score = 0.0
            reasons = []

            # Interest overlap
            cand_interests = cand_bio.get("interests", []) + cand_bio.get("about", "").lower().split()
            user_all_interests = req.interests + user_bio.get("about", "").lower().split()
            if req.interests and cand_interests:
                overlap = jaccard_similarity(set(req.interests), set(i.lower() for i in cand_interests))
                if overlap > 0:
                    score += overlap * 10
                    reasons.append(f"Shared interests: {round(overlap*100)}%")

            # Geography boost
            cand_location = cand_bio.get("location", {})
            if req.same_geography:
                if user_location.get("city") and user_location["city"] == cand_location.get("city"):
                    score += 5.0
                    reasons.append(f"Same city ({user_location['city']})")
                elif user_location.get("state") and user_location["state"] == cand_location.get("state"):
                    score += 3.0
                    reasons.append(f"Same state ({user_location['state']})")
                elif user_location.get("country") and user_location["country"] == cand_location.get("country"):
                    score += 1.5
                    reasons.append("Same country")

            # Random boost for variety
            score += random.random() * 0.5

            scored.append({
                "user_id": cand["id"],
                "score": score,
                "reasons": reasons,
                "profile": {
                    "name": cand.get("full_name") or "Anonymous",
                    "tag": cand_bio.get("tag"),
                    "avatar_url": cand.get("avatar_url"),
                    "city": cand_location.get("city"),
                    "country": cand_location.get("country_name") or cand_location.get("country"),
                },
            })

        scored.sort(key=lambda x: x["score"], reverse=True)

        if not scored:
            return {"match": None, "reason": "No matches found"}

        best = scored[0]
        return {
            "match": best,
            "alternatives": [{"user_id": s["user_id"], "score": s["score"]} for s in scored[1:6]],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/geography/{user_id}")
async def match_by_geography(user_id: str, radius: str = "city", limit: int = 20):
    """
    Find users in the same city / state / country.
    radius = 'city' | 'state' | 'country'
    """
    sb = get_client()

    try:
        user_resp = sb.table("profiles").select("*").eq("id", user_id).single().execute()
        if not user_resp.data:
            raise HTTPException(status_code=404, detail="User not found")

        user_bio = {}
        try:
            user_bio = json.loads(user_resp.data.get("bio") or "{}")
        except Exception:
            pass
        location = user_bio.get("location", {})

        if not location:
            return {"users": [], "reason": "User has no location set"}

        # Get all profiles (we'll filter in memory since location is in bio JSON)
        all_resp = sb.table("profiles").select("*").neq("id", user_id).limit(500).execute()
        profiles = all_resp.data or []

        matches = []
        for p in profiles:
            p_bio = {}
            try:
                p_bio = json.loads(p.get("bio") or "{}")
            except Exception:
                pass
            p_loc = p_bio.get("location", {})

            match = False
            if radius == "city" and location.get("city") and location["city"] == p_loc.get("city"):
                match = True
            elif radius in ("state", "city") and location.get("state") and location["state"] == p_loc.get("state"):
                match = True
            elif location.get("country") and location["country"] == p_loc.get("country"):
                match = True

            if match:
                matches.append({
                    "id": p["id"],
                    "name": p.get("full_name") or "User",
                    "avatar_url": p.get("avatar_url"),
                    "tag": p_bio.get("tag"),
                    "city": p_loc.get("city"),
                    "state": p_loc.get("state"),
                    "country": p_loc.get("country_name") or p_loc.get("country"),
                    "is_online": p.get("is_online", False),
                })

        # Sort: online first, then alphabetical
        matches.sort(key=lambda x: (not x["is_online"], x["name"]))

        return {
            "user_location": {
                "city": location.get("city"),
                "state": location.get("state"),
                "country": location.get("country_name"),
            },
            "radius": radius,
            "count": len(matches),
            "users": matches[:limit],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/by-interests")
async def match_by_interests(interests: str, user_id: Optional[str] = None, limit: int = 20):
    """
    Find users with similar interests/tags.
    `interests` is a comma-separated list.
    """
    sb = get_client()

    try:
        interest_set = set(i.strip().lower() for i in interests.split(",") if i.strip())
        if not interest_set:
            raise HTTPException(status_code=400, detail="No interests provided")

        all_resp = sb.table("profiles").select("*").limit(500).execute()
        profiles = all_resp.data or []

        if user_id:
            profiles = [p for p in profiles if p["id"] != user_id]

        matches = []
        for p in profiles:
            p_bio = {}
            try:
                p_bio = json.loads(p.get("bio") or "{}")
            except Exception:
                pass

            p_interests = set()
            # From bio.interests array
            for i in p_bio.get("interests", []):
                p_interests.add(i.lower())
            # From tag (e.g., "#engineer")
            if p_bio.get("tag"):
                p_interests.add(p_bio["tag"].replace("#", "").lower())
            # From expert area
            if p_bio.get("expert_request", {}).get("area"):
                p_interests.add(p_bio["expert_request"]["area"].lower())

            if not p_interests:
                continue

            overlap = interest_set & p_interests
            if overlap:
                p_loc = p_bio.get("location", {})
                matches.append({
                    "id": p["id"],
                    "name": p.get("full_name") or "User",
                    "avatar_url": p.get("avatar_url"),
                    "shared_interests": list(overlap),
                    "is_online": p.get("is_online", False),
                    "city": p_loc.get("city"),
                })

        matches.sort(key=lambda x: (-len(x["shared_interests"]), not x["is_online"]))
        return {"interests": list(interest_set), "count": len(matches), "users": matches[:limit]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
