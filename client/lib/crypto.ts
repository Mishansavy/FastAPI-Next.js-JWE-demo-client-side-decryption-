import { get, set } from 'idb-keyval';
import { compactDecrypt, importJWK, exportJWK, JWK } from 'jose';

// bump to v2 so we don't fight cached v1 key_ops
const PRIVATE_KEY_IDB = 'jwe-demo:v2:privateKeyJWK';
const PUBLIC_KEY_IDB  = 'jwe-demo:v2:publicKeyJWK';
const KID_IDB         = 'jwe-demo:v2:kid';

let cachedKid: string | null = null;

export function getKid() {
  return cachedKid;
}

export async function ensureKeypair() {
  const [priv, pub, kid] = await Promise.all([
    get(PRIVATE_KEY_IDB),
    get(PUBLIC_KEY_IDB),
    get(KID_IDB),
  ]);

  if (priv && pub && kid) {
    cachedKid = kid as string;
    return { privJwk: priv as JWK, pubJwk: pub as JWK, kid: kid as string };
  }

  // Generate RSA-OAEP keypair in the browser
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const privJwk = await exportJWK(keyPair.privateKey);
  const pubJwk = await exportJWK(keyPair.publicKey);

  const newKid = crypto.randomUUID();

  // Option B+ for compatibility across libs
  (pubJwk as any).kid = newKid;
  (pubJwk as any).alg = 'RSA-OAEP';
  (pubJwk as any).use = 'enc';
  (pubJwk as any).key_ops = ['wrapKey', 'encrypt'];

  (privJwk as any).kid = newKid;
  (privJwk as any).alg = 'RSA-OAEP';
  (privJwk as any).use = 'enc';
  (privJwk as any).key_ops = ['unwrapKey', 'decrypt'];

  await Promise.all([
    set(PRIVATE_KEY_IDB, privJwk),
    set(PUBLIC_KEY_IDB, pubJwk),
    set(KID_IDB, newKid),
  ]);

  cachedKid = newKid;
  return { privJwk, pubJwk, kid: newKid };
}

export async function registerPublicKey(apiBase: string, pubJwk: any, kid: string) {
  const res = await fetch(`${apiBase}/register-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ kid, public_jwk: pubJwk }),
  });
  if (!res.ok) throw new Error(`Register failed: ${res.status}`);
}

export async function decryptJWE(compactJwe: string, privJwk: any) {
  const key = await importJWK(privJwk, 'RSA-OAEP');
  const { plaintext } = await compactDecrypt(compactJwe, key);
  const text = new TextDecoder().decode(plaintext);
  return JSON.parse(text);
}
