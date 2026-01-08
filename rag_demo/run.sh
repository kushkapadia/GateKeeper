#!/bin/bash

# RAG Demo Startup Script
# This script helps you start the RAG demo application

echo "🚀 Starting Enterprise RAG Demo..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please update it with your API keys."
        echo ""
    else
        echo "❌ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check for required environment variables
if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ GEMINI_API_KEY is not set in .env file"
    echo "   Please set it to your Gemini API key"
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -q -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "Starting RAG Demo backend on http://localhost:8001"
echo "Open frontend/index.html in your browser or serve it with:"
echo "  cd frontend && python -m http.server 8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
cd backend
python -m uvicorn main:app --reload --port 8001

