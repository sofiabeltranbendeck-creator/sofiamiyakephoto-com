# sofiamiyakephoto.com

The website for Sofia Miyake Photography.

## What goes in here

The files that make up the website — HTML pages, CSS, JavaScript, and images.
Upload them into this repository and they stay versioned: every change is saved,
and any earlier version can be brought back.

## Uploading files from the browser

You don't need to install anything to add files.

1. Open this repository on github.com.
2. Click **Add file** → **Upload files**.
3. Drag the website files (or the whole folder) into the page.
4. Write a short note in the **Commit changes** box saying what you added,
   e.g. "Add the fall minis page and photos".
5. Click **Commit changes**.

Large batches of photos can take a few minutes to upload. GitHub rejects any
single file over 100 MB, so export photos for the web (under a few MB each)
rather than uploading camera originals.

## Working with a clone instead

If you'd rather work on the files on your own computer:

```bash
git clone https://github.com/sofiabeltranbendeck-creator/sofiamiyakephoto-com.git
cd sofiamiyakephoto-com
```

Then, after editing:

```bash
git add .
git commit -m "Describe what changed"
git push
```

## Structure

Nothing is fixed yet. A conventional layout for a static site:

```
index.html        the home page
css/              stylesheets
js/               scripts
images/           photographs and graphics
```

## Notes

- This repository is **public** (Netlify's free plan only auto-deploys private repos from one account). Only the owner and invited collaborators can change it.
- Don't commit passwords, API keys, or client contracts here.
