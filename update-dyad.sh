#!/bin/bash

# Dyad Update Script
# Run this when you want to update Dyad to the latest version while keeping bash tool

echo "🔄 Updating Dyad to latest version..."

# Fetch latest from upstream
echo "📡 Fetching from upstream..."
git fetch upstream

# Check what's new
echo ""
echo "📰 New changes in upstream Dyad:"
git log custom-bash-tool..upstream/main --oneline --max-count=10

echo ""
read -p "Continue with update? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Update cancelled"
    exit 1
fi

# Update main branch
echo ""
echo "🔄 Updating main branch..."
git checkout main
git merge upstream/main

# Rebase custom changes
echo ""
echo "🔄 Rebasing custom changes..."
git checkout custom-bash-tool
git rebase main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Update successful!"
    echo ""
    echo "🏷️  Tagging new version..."

    # Get current version number
    LAST_VERSION=$(git tag -l "custom-bash-v*" | sort -V | tail -1)
    echo "Last version: $LAST_VERSION"

    read -p "Enter new version (e.g., 1.1): " NEW_VERSION
    git tag -a "custom-bash-v$NEW_VERSION" -m "Dyad bash tool rebased on upstream $(git rev-parse --short upstream/main)"

    echo ""
    echo "📦 Installing dependencies..."
    npm install

    echo ""
    echo "🔨 Building..."
    npm run build

    echo ""
    echo "✅ All done! You can now run: npm start"
    echo ""
    echo "📋 Current version: custom-bash-v$NEW_VERSION"

else
    echo ""
    echo "⚠️  Conflicts detected during rebase!"
    echo ""
    echo "Please resolve conflicts manually:"
    echo "1. Edit conflicted files (shown above)"
    echo "2. Run: git add <resolved-files>"
    echo "3. Run: git rebase --continue"
    echo "4. Run: npm install && npm run build"
    exit 1
fi
