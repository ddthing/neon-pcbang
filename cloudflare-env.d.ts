declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    NEON_ADMIN_PASSWORD?: string;
    NEON_INVITE_VAULT_KEY?: string;
    ASSETS?: { fetch(request: Request): Promise<Response> };
    BUCKET?: R2Bucket;
  }
}
