"use client";

import { useEffect, useState } from "react";
import { ensureKeypair, registerPublicKey, decryptJWE } from "@/lib/crypto";

const API_BASE = "http://localhost:8000";

type PoemPayload = {
  title: string;
  author?: string;
  poem: string;
};

export default function Home() {
  const [poem, setPoem] = useState<PoemPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Create/load browser keypair and register pubkey
        const { privJwk, pubJwk, kid } = await ensureKeypair();
        await registerPublicKey(API_BASE, pubJwk, kid);

        // Fetch the JWE and decrypt locally
        const res = await fetch(
          `${API_BASE}/secret?kid=${encodeURIComponent(kid)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const { jwe } = await res.json();
        const data = (await decryptJWE(jwe, privJwk)) as PoemPayload;

        setPoem(data);
      } catch (e: any) {
        setError(e.message || String(e));
      }
    })();
  }, []);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #10131A, #0B0F17 60%, #0A0D14)",
        color: "#E8ECF1",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24,
          padding: "28px 28px 32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {!poem && !error && <div style={{ opacity: 0.8 }}>Decrypting…</div>}

        {error && (
          <pre
            style={{
              padding: 12,
              background: "#35161a",
              border: "1px solid #8a2d3b",
              color: "#ffd6dc",
              whiteSpace: "pre-wrap",
              borderRadius: 12,
            }}
          >
            {error}
          </pre>
        )}

        {poem && (
          <article>
            <h1
              style={{
                fontFamily: "Georgia, ui-serif, serif",
                fontSize: 36,
                lineHeight: 1.15,
                margin: "0 0 10px",
                letterSpacing: 0.2,
              }}
            >
              {poem.title}
            </h1>
            {poem.author && (
              <div style={{ opacity: 0.7, marginBottom: 20, fontSize: 15 }}>
                by {poem.author}
              </div>
            )}

            <div
              style={{
                fontFamily: "Georgia, ui-serif, serif",
                fontSize: 20,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                letterSpacing: 0.2,
              }}
            >
              {poem.poem}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
