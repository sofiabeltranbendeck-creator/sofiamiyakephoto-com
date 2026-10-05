// Local preview server that behaves like Netlify, which `python -m http.server` does not.
//
// Three things it gets right that a plain static server does not:
//
//   1. /.netlify/images?url=X&w=N  -> serves the file at X. Every content image on this
//      site uses the Netlify Image CDN in its srcset, and browsers prefer a srcset
//      candidate over src, so without this every photo renders broken locally.
//   2. Clean URLs. Every in-body link uses /weddings, not /weddings.html. A path that is
//      both a file and a directory (/recent-shoots) resolves to the .html file, never to
//      a directory listing.
//   3. Case-sensitive paths. Netlify is case-sensitive and Windows is not, so a local
//      server that ignores case hides exactly the bug that 404s every photo on deploy.
//
// It also blocks what _redirects blocks (*.md, /tools/*, /.work/*) so the preview shows
// what actually ships.
//
// Usage: node tools/dev-server.mjs [port]      (default 8787)

import fs from "fs";
import path from "path";
import http from "http";

const ROOT = process.cwd();
const PORT = Number(process.argv[2]) || 8787;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2",
};

// Netlify is case-sensitive. Confirm every segment matches its real on-disk casing.
function resolveExact(relPath) {
  const parts = relPath.split("/").filter(Boolean);
  let dir = ROOT;
  for (let i = 0; i < parts.length; i++) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return null; }
    if (!entries.includes(parts[i])) return null;   // exact-case match required
    dir = path.join(dir, parts[i]);
  }
  return dir;
}

function blocked(p) {
  return /\.md$/i.test(p) || p.startsWith("/tools/") || p.startsWith("/.work/");
}

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type, "Content-Length": body.length,
    "Cache-Control": "no-store" });
  res.end(body);
}

function notFound(res) {
  const f = resolveExact("404.html");
  if (f) { const b = fs.readFileSync(f); return send(res, 404, b, TYPES[".html"]); }
  send(res, 404, Buffer.from("404"), "text/plain; charset=utf-8");
}

function serveFile(res, abs, status = 200) {
  const body = fs.readFileSync(abs);
  send(res, status, body, TYPES[path.extname(abs).toLowerCase()] || "application/octet-stream");
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, "http://localhost"); } catch { return notFound(res); }
  let p = decodeURIComponent(url.pathname);

  // 1. Netlify Image CDN. Serve the original; width is ignored, which is visually
  //    identical here because every <img> carries explicit width/height.
  if (p === "/.netlify/images") {
    const src = url.searchParams.get("url");
    if (!src) return notFound(res);
    const abs = resolveExact(src.replace(/^\//, ""));
    if (!abs || !fs.statSync(abs).isFile()) {
      console.log(`  404 image-cdn  ${src}`);
      return notFound(res);
    }
    return serveFile(res, abs);
  }

  if (blocked(p)) return notFound(res);

  if (p === "/") p = "/index.html";

  // 2. Clean URLs. Prefer <path>.html over a directory of the same name.
  let rel = p.replace(/^\//, "");
  let abs = null;

  if (!path.extname(rel)) {
    abs = resolveExact(rel + ".html");
    if (!abs) {
      const asDir = resolveExact(rel);
      if (asDir && fs.statSync(asDir).isDirectory()) abs = resolveExact(rel + "/index.html");
    }
  } else {
    abs = resolveExact(rel);
    // A request for /weddings.html is a 301 to /weddings on the real site.
    if (abs && /\.html$/i.test(rel) && rel !== "404.html" && rel !== "index.html") {
      const clean = "/" + rel.replace(/\.html$/i, "");
      res.writeHead(301, { Location: clean });
      return res.end();
    }
  }

  if (!abs || !fs.statSync(abs).isFile()) {
    // 3. Report case mismatches loudly — this is the bug that 404s photos on deploy.
    const lower = rel.toLowerCase();
    const hit = (function find(dir, base) {
      let entries; try { entries = fs.readdirSync(dir); } catch { return null; }
      for (const e of entries) {
        const next = base ? base + "/" + e : e;
        if (next.toLowerCase() === lower) return next;
        if (lower.startsWith(next.toLowerCase() + "/")) {
          const deeper = find(path.join(dir, e), next);
          if (deeper) return deeper;
        }
      }
      return null;
    })(ROOT, "");
    if (hit) console.log(`  404 CASE MISMATCH  requested ${rel}  ->  on disk ${hit}`);
    else console.log(`  404  ${p}`);
    return notFound(res);
  }

  serveFile(res, abs);
});

server.listen(PORT, () => {
  console.log(`dev-server on http://localhost:${PORT}  (root ${ROOT})`);
  console.log("emulating: Netlify Image CDN, clean URLs, case-sensitive paths, _redirects blocks");
});
