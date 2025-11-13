# PWA Icons for Annotix

This directory contains the icons required for the Progressive Web App (PWA) functionality.

## Required Icon Sizes

The following icon sizes are needed for optimal PWA support across all platforms:

### Standard Icons
- `icon-72.png` - 72x72 pixels
- `icon-96.png` - 96x96 pixels
- `icon-128.png` - 128x128 pixels
- `icon-144.png` - 144x144 pixels
- `icon-152.png` - 152x152 pixels
- `icon-192.png` - 192x192 pixels (minimum required)
- `icon-384.png` - 384x384 pixels
- `icon-512.png` - 512x512 pixels (recommended)

### Maskable Icons (Optional but Recommended)
For better display on Android devices with adaptive icons:
- `icon-maskable-192.png` - 192x192 pixels (with safe zone)
- `icon-maskable-512.png` - 512x512 pixels (with safe zone)

## Design Guidelines

### Standard Icons
- Use the Annotix logo/branding
- Square format (1:1 ratio)
- Transparent background OR solid color background (#667eea theme color)
- The icon should be recognizable at small sizes

### Maskable Icons
- Use the same design as standard icons
- Add padding (safe zone) of approximately 10-20% on all sides
- The central 80% of the icon will always be visible
- The outer 20% may be masked/cropped on some devices

## How to Generate Icons

### Option 1: Using an Online Tool
1. Create a single 512x512 PNG icon with your design
2. Use a PWA icon generator like:
   - https://www.pwabuilder.com/imageGenerator
   - https://favicon.io/favicon-converter/
   - https://realfavicongenerator.net/
3. Upload your 512x512 icon
4. Download all generated sizes
5. Place them in this directory

### Option 2: Using ImageMagick (Command Line)
If you have ImageMagick installed:

```bash
# Generate all standard sizes from a source 512x512 icon
convert icon-512.png -resize 72x72 icon-72.png
convert icon-512.png -resize 96x96 icon-96.png
convert icon-512.png -resize 128x128 icon-128.png
convert icon-512.png -resize 144x144 icon-144.png
convert icon-512.png -resize 152x152 icon-152.png
convert icon-512.png -resize 192x192 icon-192.png
convert icon-512.png -resize 384x384 icon-384.png
```

### Option 3: Using Figma/Photoshop
1. Create a 512x512px artboard
2. Design your icon (centered, with appropriate padding)
3. Export at different sizes (use the list above)
4. Save as PNG with transparency

## Icon Design Recommendations

**Logo Element**: Use the `<i class="fas fa-tag"></i>` Font Awesome icon as the base
**Colors**:
- Primary: #667eea (purple-blue gradient start)
- Secondary: #764ba2 (purple gradient end)
- Background: Transparent or white

**Style**: Modern, clean, minimalist
**Content**: Icon should clearly represent "annotation" or "tagging"

## Temporary Placeholder

Until proper icons are created, you can use:
- A simple colored square with the letter "A" for Annotix
- The Font Awesome tag icon rendered at large size
- A screenshot of the app's interface scaled down

## Testing Your Icons

After adding icons:
1. Serve the app over HTTPS (required for PWA)
2. Open Chrome DevTools > Application > Manifest
3. Verify all icons are loading correctly
4. Test the install prompt on mobile and desktop
5. Check that the installed app shows the correct icon

## Platform-Specific Notes

- **iOS**: Prefers the 192x192 icon, uses the apple-touch-icon meta tag
- **Android**: Uses maskable icons for adaptive icon support
- **Desktop (Chrome/Edge)**: Uses the largest available icon (512x512)
- **Favicon**: Create a separate favicon.ico for browser tab icon
