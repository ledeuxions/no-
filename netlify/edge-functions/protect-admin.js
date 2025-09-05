export default async (request, context) => {
  const realm = "NOYP-ADMIN";
  const hdr = request.headers.get("authorization") || "";
  if (!hdr.startsWith("Basic ")) {
    return new Response("Authentication required", { status: 401, headers: { "WWW-Authenticate": `Basic realm="${realm}"` } });
  }
  let user = "", pass = "";
  try { [user, pass] = atob(hdr.split(" ")[1]).split(":"); } catch (_) {}
  const ADMIN_USER = Deno.env.get('ADMIN_USER') ?? '';
  const ADMIN_PASS = Deno.env.get('ADMIN_PASS') ?? '';
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return context.next();
  }
  return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": `Basic realm="${realm}"` } });
};
