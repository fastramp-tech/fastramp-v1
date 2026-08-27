#\!/bin/bash

# Script to change file/folder metadata dates
# Creation date: November 14, 2025
# Modification date: Random between November 14-16, 2025

PROJECT_DIR="/Users/eimis/Documents/HACKTHONS-2025/Chome AI Hackthon/FastRamp V2"

# Array of modification timestamps between Nov 14-16, 2025
MOD_DATES=(
    "202511141023"
    "202511141145"
    "202511141532"
    "202511141847"
    "202511150912"
    "202511151034"
    "202511151423"
    "202511151756"
    "202511160845"
    "202511161102"
    "202511161534"
)

# Creation date: November 14, 2025 09:00 AM
CREATION_DATE="11/14/2025 09:00:00"

# Counter for cycling through modification dates
counter=0

echo "Updating file and folder metadata..."
echo "Creation date: $CREATION_DATE"
echo ""

# Function to get a modification date from the array
get_mod_date() {
    local idx=$((counter % ${#MOD_DATES[@]}))
    echo "${MOD_DATES[$idx]}"
    ((counter++))
}

# Update all files (excluding .git, node_modules, dist)
find "$PROJECT_DIR" -type f \
    \! -path "*/.git/*" \
    \! -path "*/node_modules/*" \
    \! -path "*/dist/*" \
    \! -name ".DS_Store" \
    | while read -r file; do
    
    mod_date=$(get_mod_date)
    
    # Set creation date (macOS specific - SetFile from Xcode command line tools)
    SetFile -d "$CREATION_DATE" "$file" 2>/dev/null
    
    # Set modification date using touch
    touch -t "$mod_date" "$file"
    
    echo "Updated: $(basename "$file") -> Modified: $mod_date"
done

# Reset counter for folders
counter=0

# Update all directories (excluding .git, node_modules, dist)
find "$PROJECT_DIR" -type d \
    \! -path "*/.git/*" \
    \! -path "*/.git" \
    \! -path "*/node_modules/*" \
    \! -path "*/node_modules" \
    \! -path "*/dist/*" \
    \! -path "*/dist" \
    | while read -r dir; do
    
    mod_date=$(get_mod_date)
    
    # Set creation date (macOS specific)
    SetFile -d "$CREATION_DATE" "$dir" 2>/dev/null
    
    # Set modification date using touch
    touch -t "$mod_date" "$dir"
    
    echo "Updated folder: $(basename "$dir") -> Modified: $mod_date"
done

echo ""
echo "✅ Metadata update complete\!"
echo "All files created: November 14, 2025"
echo "All files modified: Between November 14-16, 2025"

