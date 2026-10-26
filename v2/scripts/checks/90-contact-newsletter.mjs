import { admin, anon, run, assert } from "./_clients.mjs";

const tag = Date.now();
const fresh = (iso) => Date.now() - new Date(iso).getTime() < 5 * 60_000;

await run("contact + newsletter", async () => {
  // anon can submit a contact message
  const c = await anon.from("contact_messages").insert({ name: "Probe", email: `probe-${tag}@example.com`, message: "Hallo" });
  assert(!c.error, "anon can submit contact message");

  // anon can subscribe
  const n = await anon.from("newsletter_subscribers").insert({ email: `probe-${tag}@example.com` });
  assert(!n.error, "anon can subscribe newsletter");

  // anon cannot read contact messages / subscribers
  const read = await anon.from("contact_messages").select("id").limit(1);
  assert(!read.error && (read.data?.length ?? 0) === 0, "anon cannot read contact messages");
  const readNl = await anon.from("newsletter_subscribers").select("id").limit(1);
  assert(!readNl.error && (readNl.data?.length ?? 0) === 0, "anon cannot read newsletter subscribers");

  // admin can read
  const adminRead = await admin.from("contact_messages").select("id").limit(1);
  assert(!adminRead.error && (adminRead.data?.length ?? 0) >= 1, "admin can read contact messages");

  // cleanup probe rows
  await admin.from("contact_messages").delete().like("email", "probe-%@example.com");
  await admin.from("newsletter_subscribers").delete().like("email", "probe-%@example.com");
});

// Anonymous inserts: the server decides created_at and every admin-only column.
await run("public write hardening", async () => {
  const forged = "11111111-2222-3333-4444-555555555555";
  const nlEmail = `Harden-${tag}@Example.com`;
  const contactId = crypto.randomUUID();
  const bulkId = crypto.randomUUID();
  const reviewId = crypto.randomUUID();
  const old = "2000-01-01T00:00:00Z";
  try {
    // newsletter: no self-chosen token / confirmation, address lower-cased
    const n = await anon.from("newsletter_subscribers").insert({
      email: ` ${nlEmail} `, confirm_token: forged, confirmed_at: new Date().toISOString(), created_at: old,
    });
    assert(!n.error, "anon newsletter insert with forged fields is accepted (fields reset)");
    const nl = await admin.from("newsletter_subscribers")
      .select("email, confirm_token, confirmed_at, confirmation_sent_at, created_at").eq("email", nlEmail.toLowerCase()).maybeSingle();
    assert(!!nl.data && nl.data.confirm_token !== forged, "newsletter confirm token is generated server-side");
    assert(!!nl.data && !nl.data.confirmed_at && !nl.data.confirmation_sent_at, "newsletter signup stays unconfirmed");
    assert(!!nl.data && fresh(nl.data.created_at), "newsletter created_at is set by the server");
    const dup = await anon.from("newsletter_subscribers").insert({ email: nlEmail.toUpperCase() });
    assert(dup.error?.code === "23505", "newsletter address is unique case-insensitively");

    // the forged token can't confirm anything (no mail is sent by this call)
    const conf = await anon.functions.invoke("newsletter", { body: { action: "confirm", token: forged } });
    assert(!!conf.error, "newsletter confirm rejects a forged token");

    // contact / bulk / review: admin-only columns reset, client id kept
    const c = await anon.from("contact_messages").insert({
      id: contactId, name: "Harden", email: `harden-${tag}@example.com`, message: "x", handled: true, created_at: old,
      notified_at: new Date().toISOString(),
    });
    assert(!c.error, "anon contact insert with preset admin fields is accepted (fields reset)");
    const cm = await admin.from("contact_messages").select("handled, created_at, notified_at").eq("id", contactId).maybeSingle();
    assert(!!cm.data && cm.data.handled === false && !cm.data.notified_at && fresh(cm.data.created_at),
      "contact: handled=false, notified_at=null, created_at=now, client id kept");

    const b = await anon.from("bulk_inquiries").insert({ id: bulkId, email: `harden-${tag}@example.com`, status: "abgeschlossen", created_at: old });
    assert(!b.error, "anon bulk inquiry insert is accepted");
    const bi = await admin.from("bulk_inquiries").select("status, created_at").eq("id", bulkId).maybeSingle();
    assert(!!bi.data && bi.data.status === "neu" && fresh(bi.data.created_at), "bulk inquiry: status=neu, created_at=now");

    const p = await admin.from("products").select("id").limit(1).maybeSingle();
    if (p.data) {
      const r = await anon.from("reviews").insert({ id: reviewId, product_id: p.data.id, rating: 5, name: `Harden ${tag}`, text: "x", approved: true, created_at: old });
      assert(!r.error, "anon review insert is accepted");
      const rv = await admin.from("reviews").select("approved, created_at").eq("id", reviewId).maybeSingle();
      assert(!!rv.data && rv.data.approved === false && fresh(rv.data.created_at), "review: approved=false, created_at=now");
    }

    // per-sender rate limit still applies to anon (3 contact messages / 10 min)
    const codes = [];
    for (let i = 0; i < 3; i++) {
      const x = await anon.from("contact_messages").insert({ name: "Limit", email: `limit-${tag}@example.com`, message: "x", created_at: old });
      codes.push(x.error?.code ?? "ok");
    }
    const x = await anon.from("contact_messages").insert({ name: "Limit", email: `limit-${tag}@example.com`, message: "x", created_at: old });
    assert(codes.every((s) => s === "ok") && x.error?.code === "P0001", "anon per-sender rate limit holds despite a backdated created_at");

    // the service role is not rate-limited and keeps its values
    const svc = [];
    for (let i = 0; i < 4; i++) {
      const s = await admin.from("contact_messages").insert({ name: "Svc", email: `svc-${tag}@example.com`, message: "x", handled: true });
      svc.push(s.error?.code ?? "ok");
    }
    assert(svc.every((s) => s === "ok"), "service role is not rate-limited");
  } finally {
    await admin.from("newsletter_subscribers").delete().eq("email", nlEmail.toLowerCase());
    await admin.from("contact_messages").delete().in("email", [`harden-${tag}@example.com`, `limit-${tag}@example.com`, `svc-${tag}@example.com`]);
    await admin.from("bulk_inquiries").delete().eq("id", bulkId);
    await admin.from("reviews").delete().eq("id", reviewId);
  }
});
