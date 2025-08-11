from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jwcrypto import jwk, jwe
import json
import time

app = FastAPI()

# Allow your Next.js dev origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory map: kid -> public JWK (dict)
CLIENT_KEYS: dict[str, dict] = {}

class RegisterKeyIn(BaseModel):
    kid: str
    public_jwk: dict

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/register-key")
def register_key(body: RegisterKeyIn):
    # Validate it's a usable JWK
    try:
        _ = jwk.JWK.from_json(json.dumps(body.public_jwk))
    except Exception as e:
        raise HTTPException(400, f"Invalid JWK: {e}")
    CLIENT_KEYS[body.kid] = body.public_jwk
    return {"ok": True}

@app.get("/secret")
def get_secret(kid: str):
    if kid not in CLIENT_KEYS:
        raise HTTPException(404, "Unknown kid")
    pub = jwk.JWK.from_json(json.dumps(CLIENT_KEYS[kid]))

    # ✨ Your poem payload (plaintext before JWE)
    payload = {
        "title": "A Quiet Conspiracy of Stars",
        "author": "Anonymous",
        "issued_at": int(time.time()),
        "poem": (
            "I love you in the unshowy ways:\n"
            "the kettle reaching bloom-point,\n"
            "the window deciding to hold the morning.\n"
            "\n"
            "Your name is a soft password\n"
            "the day keeps forgetting\n"
            "until your laugh logs me in.\n"
            "\n"
            "We are two travelers with one map,\n"
            "folding the creases to bring\n"
            "distant towns together.\n"
            "\n"
            "Come closer—see how the night\n"
            "leans its shoulder into ours,\n"
            "a quiet conspiracy of stars,\n"
            "\n"
            "signing the dark with light enough\n"
            "to read your heartbeat by."
        ),
    }
    plaintext = json.dumps(payload).encode("utf-8")

    # Compact JWE using RSA-OAEP + A256GCM
    protected_hdr = json.dumps({
        "alg": "RSA-OAEP",
        "enc": "A256GCM",
        "kid": kid,
        "typ": "JWE"
    })

    token = jwe.JWE(
        plaintext=plaintext,
        protected=protected_hdr
    )
    token.add_recipient(pub)
    compact = token.serialize(compact=True)

    # Only this opaque blob goes over the wire
    return {"jwe": compact}
