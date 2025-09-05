import { env } from "netlify:env";

export default async (request, context) => {
  const realm = "NOYP-ADMIN";
  const hdr = request.headers.get("authorization") || "";
  if (!hdr.startsWith("Basic ")) {
    return new Response("Authentication required", { status: 401, headers: { "WWW-Authenticate": `Basic realm="${realm}"` } });
  }
  let user = "", pass = "";
  try { [user, pass] = atob(hdr.split(" ")[1]).split(":"); } catch (_) {}
  if (user === env.ADMIN_USER && pass === env.ADMIN_PASS) {
    return context.next();
  }
  return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": `Basic realm="${realm}"` } });
};
