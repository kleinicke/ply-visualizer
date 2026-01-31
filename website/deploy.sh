#!/bin/bash

# Simple deployment script for the 3D Point Cloud Visualizer website

echo "🚀 Building 3D Point Cloud Visualizer for production..."

# Clean and build
rm -rf dist/
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build completed successfully!"

# Webpack CopyPlugin handles all file copying with path transformations:
# - /index.html → About page (profile)
# - /3d-visualizer/index.html → 3D Visualizer
# - /about/impressum.html, /about/datenschutz.html → Legal pages
# - /media/ → Static assets

echo "📦 Files in dist/ directory:"
ls -la dist/

echo ""
echo "🌐 Website ready for deployment!"
echo "Contents of dist/ directory can be uploaded to any web server."
echo ""
echo "Local testing:"
echo "  cd dist && python -m http.server 8000"
echo "  Then open http://localhost:8000"