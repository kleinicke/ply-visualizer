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

# Copy HTML and assets
cp index.html dist/
cp -r media/ dist/media/

echo "📦 Files copied to dist/ directory:"
ls -la dist/

echo ""
echo "🌐 Website ready for deployment!"
echo "Contents of dist/ directory can be uploaded to any web server."
echo ""
echo "Local testing:"
echo "  cd dist && python -m http.server 8000"
echo "  Then open http://localhost:8000"