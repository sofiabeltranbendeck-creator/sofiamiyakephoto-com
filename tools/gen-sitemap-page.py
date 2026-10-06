# Builds sitemap.html from privacy.html, which is the site's existing
# text-page template (same header, footer, analytics and business schema).
import io, re

src = io.open('privacy.html', encoding='utf-8').read()

TITLE = 'Site Map &mdash; Sofia Miyake Photography'
DESC = ('Every page on sofiamiyakephoto.com in one place &mdash; family, wedding, '
        'engagement, senior, portrait and birth sessions in Roseville and Sacramento, '
        'plus the session journal and booking.')

head_swaps = [
 (r'<title>.*?</title>', '<title>%s</title>' % TITLE),
 (r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % DESC),
 (r'<link rel="canonical" href="[^"]*">',
  '<link rel="canonical" href="https://sofiamiyakephoto.com/sitemap">'),
 (r'<meta property="og:url" content="[^"]*">',
  '<meta property="og:url" content="https://sofiamiyakephoto.com/sitemap">'),
 (r'<meta property="og:title" content="[^"]*">',
  '<meta property="og:title" content="%s">' % TITLE),
 (r'<meta property="og:description" content="[^"]*">',
  '<meta property="og:description" content="%s">' % DESC),
 (r'<meta property="og:image" content="[^"]*">',
  '<meta property="og:image" content="https://sofiamiyakephoto.com/images/og/home.jpg">'),
 # The template carries privacy.html's BreadcrumbList. Without these two swaps the
 # generated page tells Google it is the privacy policy, which is how sitemap.html
 # ended up with the wrong trail.
 (r'"name": "Privacy Policy"', '"name": "Site Map"'),
 (r'"item": "https://sofiamiyakephoto\.com/privacy"',
  '"item": "https://sofiamiyakephoto.com/sitemap"'),
]
# A function replacement, so nothing in the new text is read as a group reference.
for pat, rep in head_swaps:
    src, n = re.subn(pat, lambda m, r=rep: r, src, count=1, flags=re.S)
    assert n == 1, pat

# root-relative assets, so the page is safe to move
src = src.replace('href="css/style.css"', 'href="/css/style.css"')
src = src.replace('href="images/', 'href="/images/')
src = src.replace('src="js/main.js"', 'src="/js/main.js"')


def group(label, heading, blurb, rows):
    items = '\n'.join(
        '      <li><a href="%s">%s</a><span>%s</span></li>' % r for r in rows)
    return '''
<section class="%s">
  <div class="container" style="max-width:860px;">
    <h2 class="reveal">%s</h2>
    <p class="reveal" style="color:var(--ink-soft);max-width:60ch;">%s</p>
    <ul class="sitemap-list reveal">
%s
    </ul>
  </div>
</section>
''' % (label, heading, blurb, items)


main = '''
<section style="padding-bottom:24px;">
  <div class="container" style="max-width:860px;">
    <p class="section-label left reveal">Index</p>
    <h1 class="reveal" style="font-size:clamp(2rem,4vw,3rem);">Every page on this site</h1>
    <p class="reveal" style="color:var(--ink-soft);max-width:62ch;">Documentary photography in
    Roseville, Rocklin, Granite Bay, Folsom and greater Sacramento. If you are looking for
    something specific, it is on this page.</p>
  </div>
</section>
'''

main += group('cream', 'Start here',
  'The front door, and the three ways to begin depending on how far along you are.', [
  ('/', 'Home',
   'Recent work, what Sofia photographs, and where she photographs it.'),
  ('/bookings', 'Book a session',
   'Book a date directly, schedule a call, or send an enquiry.'),
  ('/bookings#call', 'Schedule a call',
   'Fifteen minutes on the phone before you commit to anything.'),
  ('/bookings#inquire', 'Send an enquiry',
   'For dates, availability and anything not answered on the site.'),
])

main += group('linen', 'Sessions',
  'What a session with Sofia looks like, what it costs, and what you take home.', [
  ('/families', 'Family sessions',
   'Documentary family photography in Roseville, Rocklin and Sacramento. Sessions from $350.'),
  ('/fall-minis', 'Mini sessions',
   'Short, seasonal sessions at a fixed price &mdash; the easiest way to start.'),
  ('/weddings', 'Weddings',
   'Full wedding coverage across Sacramento and Placer County, with pricing and an FAQ.'),
  ('/engagements', 'Engagements',
   'Engagement sessions, and how they work as a rehearsal for a wedding day.'),
  ('/portraits', 'Portraits',
   'Individual portrait sessions &mdash; personal, professional and everything between.'),
  ('/seniors', 'Seniors &amp; grads',
   'Senior portraits for Roseville, Rocklin and Sacramento-area students.'),
  ('/birth-stories', 'Birth stories',
   'On-call birth photography, from labour through the first hours.'),
])

main += group('cream', 'Galleries and journal',
  'Recent work, and the story behind individual sessions.', [
  ('/wedding-gallery', 'Wedding gallery',
   'A full gallery of wedding work, separate from the pricing page.'),
  ('/recent-shoots', 'Recent sessions',
   'The index of recent session stories, newest first.'),
  ('/recent-shoots/roseville-golden-hour-family-session', 'An evening in the long grass',
   'A golden-hour family session in Roseville &mdash; September 2026.'),
  ('/recent-shoots/sacramento-golden-hour-family-session', 'The last hour of the light',
   'Four kids and one open field in Sacramento &mdash; August 2026.'),
  ('/recent-shoots/roseville-afternoon-family-session', 'Nobody standing still',
   'An afternoon family session in Roseville &mdash; August 2026.'),
])

main += group('linen', 'About',
  'Who Sofia is and how she works.', [
  ('/miyake-vision', 'Miyake Vision',
   'The approach behind the work &mdash; why these photographs look the way they do.'),
  ('/miyake-rant', 'Miyake Rant',
   'Longer-form writing on photography, honestly held opinions included.'),
  ('/the-artists-escape', "The Artist's Escape",
   'A project page, separate from the client work.'),
])

main += group('cream', 'Small print',
  'The pages nobody reads until they need them.', [
  ('/privacy', 'Privacy policy',
   'What this site collects, what it does with it, and how to ask for it back.'),
  ('/sitemap.xml', 'XML sitemap',
   'The machine-readable version of this page, for search engines.'),
])

main += '''
<section class="cta-band">
  <div class="container reveal center">
    <h2>Didn&rsquo;t find it?</h2>
    <p>Call (805) 422-0130 or email contact@sofiamiyakephoto.com and ask.</p>
    <a href="/bookings" class="btn btn-light">Go to booking</a>
  </div>
</section>
'''

start = src.index('<main id="main">') + len('<main id="main">')
end = src.index('</main>')
src = src[:start] + '\n' + main + '\n' + src[end:]

io.open('sitemap.html', 'w', encoding='utf-8', newline='').write(src)
print('sitemap.html written, %d bytes' % len(src))
