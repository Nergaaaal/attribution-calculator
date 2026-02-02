#!/bin/bash

# Marketing Attribution Models - Quick Start Script

echo "📊 Marketing Attribution Models - Streamlit App"
echo "=============================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install streamlit pandas numpy plotly

echo ""
echo "✅ Setup complete!"
echo ""
echo "Starting Streamlit app..."
echo "The app will open at http://localhost:8501"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

streamlit run app.py
