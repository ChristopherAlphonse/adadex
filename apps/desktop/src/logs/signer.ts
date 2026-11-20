import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Signer {
  /** The public half as PEM, so anyone can check a signature without the app. */
  readonly publicKey: string;
  /** A short id for the key, stored with each signature. */
  readonly keyId: string;
  sign(data: string): string;
}

/** Wraps the private key for storage. In Electron this is the operating system's keychain; tests may pass a fake. */
export interface KeyProtector {
  protect(plain: Buffer): Buffer;
  unprotect(stored: Buffer): Buffer;
}

const NONE: KeyProtector = { protect: (b) => b, unprotect: (b) => b };

export const keyIdOf = (publicKeyPem: string): string =>
  createHash("sha256").update(publicKeyPem).digest("hex").slice(0, 16);

export const verifySignature = (
  publicKeyPem: string,
  data: string,
  signatureBase64: string,
): boolean => {
  try {
    return verify(
      null,
      Buffer.from(data),
      createPublicKey(publicKeyPem),
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
};

/**
 * A per-machine Ed25519 signing key, made on first use. The private key is stored mode 0600 in `dir`, wrapped by
 * `protector` when one is given. Someone who can rewrite the log database but cannot use this key cannot produce
 * lines that verify.
 */
export const createFileSigner = (dir: string, protector: KeyProtector = NONE): Signer => {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const privatePath = join(dir, "audit-signing.key");
  const publicPath = join(dir, "audit-signing.pub");

  if (!existsSync(privatePath)) {
    const pair = generateKeyPairSync("ed25519");
    const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    writeFileSync(privatePath, protector.protect(Buffer.from(privatePem)), { mode: 0o600 });
    writeFileSync(publicPath, pair.publicKey.export({ type: "spki", format: "pem" }) as string, {
      mode: 0o644,
    });
    chmodSync(privatePath, 0o600);
  }
  const privateKey = createPrivateKey(protector.unprotect(readFileSync(privatePath)).toString());
  const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" }) as string;
  return {
    publicKey,
    keyId: keyIdOf(publicKey),
    sign: (data) => sign(null, Buffer.from(data), privateKey).toString("base64"),
  };
};
