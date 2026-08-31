// functions/sitemap.xml.js
// Cloudflare Pages Function — serves a dynamically generated sitemap.xml.
// Discovers published vol*.html / trend*.html by requesting them from the
// same deployment, gap-tolerant (a published vol50.html is still included
// even if vol49.html doesn't exist), so the sitemap never needs manual edits.

async function discoverSeries(origin, prefix, { maxN = 200, batch = 25, maxConsecutiveMiss = 25 } = {}) {
  const found = [];
  let n = 1, consecutiveMiss = 0;

  while (n <= maxN && consecutiveMiss < maxConsecutiveMiss) {
    const nums = [];
    for (let i = 0; i < batch && n <= maxN; i++, n++) nums.push(n);

    const results = await Promise.all(
      nums.map(async (num) => {
        try {
          const res = await fetch(`${origin}/${prefix}${num}.html`, { method: "HEAD" });
          return { num, ok: res.ok };
        } catch (e) {
          return { num, ok: false };
        }
      })
    );

    let batchHadHit = false;
    for (const r of results) {
      if (r.ok) {
        found.push(r.num);
        consecutiveMiss = 0;
        batchHadHit = true;
      }
    }
    if (!batchHadHit) consecutiveMiss += batch;
  }

  found.sort((a, b) => a - b);
  return found;
}

export async function onRequest(context) {
  const origin = new URL(context.request.url).origin;
  const today = new Date().toISOString().split("T")[0];

  const [volNums, trendNums] = await Promise.all([
    discoverSeries(origin, "vol"),
    discoverSeries(origin, "trend"),
  ]);

  const staticUrls = [
    { loc: `${origin}/index.html`, priority: "1.0", changefreq: "daily" },
    { loc: `${origin}/vol.html`, priority: "0.9", changefreq: "daily" },
    { loc: `${origin}/trend.html`, priority: "0.7", changefreq: "weekly" },
  ];

  const volUrls = volNums.map((n) => ({
    loc: `${origin}/vol${n}.html`,
    priority: "0.8",
    changefreq: "monthly",
  }));

  const trendUrls = trendNums.map((n) => ({
    loc: `${origin}/trend${n}.html`,
    priority: "0.6",
    changefreq: "monthly",
  }));

  const allUrls = [...staticUrls, ...volUrls, ...trendUrls];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    allUrls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${u.loc}</loc>\n` +
          `    <lastmod>${today}</lastmod>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          `  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Cache at Cloudflare's edge for an hour so every crawler hit doesn't
      // re-trigger the full discovery scan; still refreshes regularly.
      "cache-control": "public, max-age=3600",
    },
  });
}
