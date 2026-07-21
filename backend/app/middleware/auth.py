from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config.settings import settings
from app.models.database import supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        
        if alg == "HS256":
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return payload
        else:
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                raise HTTPException(status_code=401, detail="Invalid or expired session token.")
            
            user = user_response.user
            payload = {
                "sub": user.id,
                "email": user.email,
                "user_metadata": user.user_metadata or {}
            }
            return payload
            
    except JWTError as e:
        try:
            user_response = supabase.auth.get_user(token)
            if user_response and user_response.user:
                user = user_response.user
                return {
                    "sub": user.id,
                    "email": user.email,
                    "user_metadata": user.user_metadata or {}
                }
        except Exception:
            pass
        raise HTTPException(status_code=401, detail=f"Authentication payload decoding failed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication verification failed: {str(e)}")

def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Subject UID missing from authentication claims.")
    
    response = supabase.table("profiles").select("role").eq("id", user_id).execute()
    if not response.data or response.data[0].get("role") != "admin":
         raise HTTPException(status_code=403, detail="Operator requires elevated administrator credentials.")
    return current_user
