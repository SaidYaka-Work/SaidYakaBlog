# Scheduled Posts Quick Reference

## How to Schedule a Post

Simply set a future date in your post's frontmatter:

```yaml
---
slug: "my-future-post"
title: "This Will Publish on Christmas"
date: 2025-12-25  # Post goes live on this date
author: Said Yaka
tags:
  - AI
---
```

## What Happens

### While Writing (Development)
✅ You see all posts (including future-dated)
✅ Preview at http://localhost:3000/posts/my-future-post
✅ Test everything before it goes live

### On Your Live Site (Production)
❌ Future posts are hidden until their date
❌ Not visible in post lists, sitemap, or RSS
✅ Automatically published when date arrives

## Publishing Schedule

Your blog rebuilds **daily at midnight UTC** via GitHub Actions.

This means:
- Post dated `2025-12-25` goes live on December 25 at 00:00 UTC
- No manual deployment needed
- Future posts appear automatically

## Manual Publish (If Needed)

To publish immediately without waiting for midnight:

1. Go to your repo on GitHub
2. Click **Actions** tab
3. Select "Deploy to GitHub Pages"
4. Click **Run workflow** → **Run workflow**

## Workflow Status

Check deployment history:
- **Actions** tab shows all builds
- Green checkmark = successful deploy
- Red X = build failed (check logs)

## Time Zones

Posts publish at **00:00 UTC** on their date.

Convert to your timezone:
- PST: UTC - 8 hours (4pm previous day)
- EST: UTC - 5 hours (7pm previous day)
- CET: UTC + 1 hour (1am same day)

Want 9am EST release? Set date to previous day:
```yaml
date: 2025-12-24  # Actually publishes 7pm EST = 9am EST next day
```

## Tips

**Batch Writing:**
Write 10 posts today, schedule them 2 days apart:
```
post-1.mdx → date: 2025-10-20
post-2.mdx → date: 2025-10-22
post-3.mdx → date: 2025-10-24
...
```

**Content Buffer:**
Always have 5-10 scheduled posts ready. Never scramble to write!

**Preview Before Publish:**
Test in dev mode, then just push to GitHub. Auto-deployment handles the rest.

## Troubleshooting

**Post not showing up?**
- Check the date isn't in the future
- Verify workflow ran (Actions tab)
- Ensure post has proper frontmatter

**Want to unpublish?**
- Change date to future: `date: 2099-12-31`
- Push to GitHub
- Next rebuild will hide it

**Need to edit published post?**
- Just edit the file
- Push to GitHub
- Changes deploy automatically

---

Set it and forget it! Your blog publishes on schedule. 🚀
