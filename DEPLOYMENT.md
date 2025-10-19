# GitHub Pages Deployment with Auto-Scheduling

This blog automatically rebuilds daily to publish scheduled posts.

## Setup Instructions

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select:
   - Source: **GitHub Actions** (not "Deploy from a branch")
4. Save

### 2. Push the Workflow

The workflow file is already in `.github/workflows/deploy.yml`. Just push to GitHub:

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions deployment workflow"
git push origin main
```

### 3. Verify Deployment

1. Go to the **Actions** tab in your repo
2. You should see "Deploy to GitHub Pages" running
3. Wait for it to complete (takes ~2-3 minutes)
4. Your site will be live at: `https://<username>.github.io/<repo-name>/`

## How It Works

### Automatic Triggers

The workflow runs in 3 scenarios:

1. **On Push to Main** - Deploys immediately when you push changes
2. **Daily at Midnight UTC** - Rebuilds to publish scheduled posts
3. **Manual Trigger** - You can manually run from Actions tab

### Scheduled Posts

Posts with future dates are automatically published when their date arrives:

```yaml
---
date: 2025-12-25  # Will go live on Christmas
---
```

No need to manually deploy when a post's date arrives!

### Troubleshooting

**Workflow not running?**
- Check **Settings** → **Actions** → **General**
- Ensure "Allow all actions and reusable workflows" is enabled
- Verify **Pages** source is set to "GitHub Actions"

**Build failing?**
- Check the Actions tab for error logs
- Ensure `npm run build` works locally
- Verify all dependencies are in package.json

**Want to trigger manually?**
1. Go to **Actions** tab
2. Select "Deploy to GitHub Pages"
3. Click "Run workflow"

## Custom Domain (Optional)

To use a custom domain like `blog.yourdomain.com`:

1. Add a `CNAME` file to `/public/` with your domain:
   ```
   blog.yourdomain.com
   ```
2. In your DNS provider, add a CNAME record:
   ```
   CNAME blog yourusername.github.io
   ```
3. In GitHub Settings → Pages, add your custom domain

## Monitoring

- View deployment history: **Actions** tab
- Check site status: **Settings** → **Pages**
- Last deploy time: Visible in Actions runs

---

Your blog now auto-publishes scheduled posts every day at midnight UTC! 🎉
