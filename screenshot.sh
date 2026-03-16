#!/usr/bin/env bash
# screenshot.sh — serve the Morp frontend and take a screenshot
# Usage:  ./screenshot.sh [output-name]
# Output: opens screenshot in default Windows viewer

set -e

PORT=7788
OUT_NAME="${1:-morp-$(date +%H%M%S)}.png"
OUT_PATH="/mnt/c/Users/cownj/AppData/Local/Temp/playwright-mcp-output/$OUT_NAME"
FRONTEND_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"

# Kill any existing server on that port
fuser -k ${PORT}/tcp 2>/dev/null || true

# Start server
python3 -m http.server $PORT --directory "$FRONTEND_DIR" &>/tmp/morp-server.log &
SERVER_PID=$!
sleep 0.5

echo "Server PID $SERVER_PID on port $PORT"
echo "Screenshot → $OUT_PATH"

# Take screenshot via Playwright (using npx playwright)
node - <<EOF
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 720 } });
  await page.goto('http://localhost:${PORT}/');
  await page.screenshot({ path: '${OUT_PATH}', fullPage: false });
  await browser.close();
  console.log('Screenshot saved.');
})();
EOF

# Open in Windows
explorer.exe "$(wslpath -w "$OUT_PATH")" 2>/dev/null || true

# Cleanup
kill $SERVER_PID 2>/dev/null || true
echo "Done."
