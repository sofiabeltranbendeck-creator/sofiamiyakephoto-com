# Regenerates sitemap.xml from the files on disk.
# URL order follows site navigation, not alphabetical — a sitemap is also a
# statement about which pages matter.
import io, os, re, subprocess, sys, datetime

BASE = 'https://sofiamiyakephoto.com'

# file -> public path. 404 and thank-you carry <meta robots noindex>; a URL
# cannot be both "please index this" and "do not index this", so they are out.
ORDER = [
    ('index.html',            '/'),
    ('families.html',         '/families'),
    ('fall-minis.html',       '/fall-minis'),
    ('weddings.html',         '/weddings'),
    ('wedding-gallery.html',  '/wedding-gallery'),
    ('engagements.html',      '/engagements'),
    ('portraits.html',        '/portraits'),
    ('seniors.html',          '/seniors'),
    ('birth-stories.html',    '/birth-stories'),
    ('bookings.html',         '/bookings'),
    ('recent-shoots.html',    '/recent-shoots'),
    ('recent-shoots/roseville-golden-hour-family-session.html',
     '/recent-shoots/roseville-golden-hour-family-session'),
    ('recent-shoots/sacramento-golden-hour-family-session.html',
     '/recent-shoots/sacramento-golden-hour-family-session'),
    ('recent-shoots/roseville-afternoon-family-session.html',
     '/recent-shoots/roseville-afternoon-family-session'),
    ('miyake-vision.html',    '/miyake-vision'),
    ('miyake-rant.html',      '/miyake-rant'),
    ('the-artists-escape.html', '/the-artists-escape'),
    ('sitemap.html',          '/sitemap'),
    ('privacy.html',          '/privacy'),
]

# Site chrome, not content. Everything else on a photography site is the point.
SKIP_IMAGES = {'/images/favicon.png'}


def lastmod(path):
    """Date of the last commit that touched the file; today if untracked."""
    try:
        out = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cs', '--', path],
            stderr=subprocess.STDOUT).decode().strip()
        if re.match(r'^\d{4}-\d\d-\d\d$', out):
            return out
    except Exception:
        pass
    return datetime.date.today().isoformat()


def images_in(path):
    """Every distinct source image the page references.

    Matches the master path whether it is written raw (src="/images/x.jpg"),
    relatively (src="images/x.jpg"), inside a srcset, or wrapped in a Netlify
    Image CDN query (/.netlify/images?url=/images/x.jpg&w=640). The sitemap
    lists the MASTER url, never the CDN one: the CDN url is a transform of the
    master, and listing both offers Google the same photograph twice.
    """
    s = io.open(path, encoding='utf-8').read()
    seen = []
    for m in re.findall(r'/?images/[A-Za-z0-9_.\-]+\.(?:jpg|jpeg|png|webp)', s, re.I):
        p = '/' + m.lstrip('/')
        if p in SKIP_IMAGES or p in seen:
            continue
        if not os.path.exists(p.lstrip('/')):
            sys.stderr.write('MISSING on disk, skipped: %s (in %s)\n' % (p, path))
            continue
        seen.append(p)
    return seen


def esc(u):
    return u.replace('&', '&amp;').replace("'", '&apos;')


out = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
       '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']

pages = imgs = 0
for f, url in ORDER:
    if not os.path.exists(f):
        sys.stderr.write('MISSING PAGE: %s\n' % f)
        continue
    out.append('  <url>')
    out.append('    <loc>%s%s</loc>' % (BASE, esc(url)))
    out.append('    <lastmod>%s</lastmod>' % lastmod(f))
    for img in images_in(f):
        # Google reads <image:loc> only. image:title, image:caption,
        # image:geo_location and image:license were deprecated in 2022 and
        # are ignored, so emitting them would be decoration.
        out.append('    <image:image><image:loc>%s%s</image:loc></image:image>'
                   % (BASE, esc(img)))
        imgs += 1
    out.append('  </url>')
    pages += 1

out.append('</urlset>')
io.open('sitemap.xml', 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
sys.stderr.write('sitemap.xml: %d urls, %d image entries\n' % (pages, imgs))
