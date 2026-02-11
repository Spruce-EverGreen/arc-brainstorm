# Arc Brainstorm — Quick Start

## Setup (first time only)

```bash
cd /Users/aiuser/.openclaw/workspace/projects/arc-brainstorm
npm install
```

## Run Locally

```bash
npm run dev
```

This starts a server on `http://localhost:5173`

## On Your 2-in-1

1. Open a terminal on your Mac
2. Run `npm run dev`
3. On the 2-in-1 (or any device on your network):
   - Open browser
   - Go to `http://<your-mac-ip>:5173`
   - (Find your Mac's IP: `ifconfig | grep "inet "`)

Or simpler: just open `http://localhost:5173` if the 2-in-1 is the same machine.

## Use It

1. **Draw boxes** — Click the Box tool (▢), drag on canvas
2. **Connect boxes** — Click the Arrow tool (→), click from one box to another
3. **Label** — Click the Text tool (T), click to add labels. Or double-click a box to edit its label
4. **Color** — Click a color in the top bar, then click a box to change its color
5. **Export** — Click "View JSON" to see the structure, or "Export" to download

## Export for Willow

Once you've sketched your idea:
1. Click **Export** button
2. A JSON file downloads
3. Send it to Willow with a note: "Here's my brainstorm sketch. Spec this out."

---

That's it. Draw, export, spec.
