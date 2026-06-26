import { admin, anon, run, assert } from "./_clients.mjs";

await run("contact + newsletter", async () => {
  // anon can submit a contact message
  const c = await anon.from("contact_messages").insert({ name: "Probe", email: "p@example.com", message: "Hallo" });
  assert(!c.error, "anon can submit contact message");

  // anon can subscribe
  const n = await anon.from("newsletter_subscribers").insert({ email: `probe-${Date.now()}@example.com` });
  assert(!n.error, "anon can subscribe newsletter");

  // anon cannot read contact messages
  const read = await anon.from("contact_messages").select("id").limit(1);
  assert(!read.error && (read.data?.length ?? 0) === 0, "anon cannot read contact messages");

  // admin can read
  const adminRead = await admin.from("contact_messages").select("id").limit(1);
  assert(!adminRead.error && (adminRead.data?.length ?? 0) >= 1, "admin can read contact messages");

  // cleanup probe rows
  await admin.from("contact_messages").delete().eq("email", "p@example.com");
  await admin.from("newsletter_subscribers").delete().like("email", "probe-%@example.com");
});
