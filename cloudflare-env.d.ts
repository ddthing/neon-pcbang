declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    NEON_ADMIN_PASSWORD?: string;
    ASSETS?: { fetch(request: Request): Promise<Response> };
    BUCKET?: R2Bucket;
  }
}
