#!/usr/bin/env python3
"""
RAG Demo Startup Script
Helps start the RAG demo application with proper environment setup.
"""

import os
import sys
import subprocess
from pathlib import Path

def check_env_file():
    """Check if .env file exists, create from example if needed."""
    env_file = Path(__file__).parent / ".env"
    env_example = Path(__file__).parent / ".env.example"
    
    if not env_file.exists():
        print("⚠️  .env file not found.")
        if env_example.exists():
            print("Creating .env from .env.example...")
            env_file.write_text(env_example.read_text())
            print("✅ Created .env file. Please update it with your API keys.")
            print()
        else:
            print("❌ .env.example not found.")
            print("Please create .env manually with:")
            print("  GEMINI_API_KEY=your-api-key")
            print("  GATEKEEPER_URL=http://localhost:8000")
            return False
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv(env_file)
    
    return True

def check_requirements():
    """Check if required environment variables are set."""
    if not os.getenv("GEMINI_API_KEY"):
        print("❌ GEMINI_API_KEY is not set in .env file")
        print("   Please set it to your Gemini API key")
        return False
    return True

def install_dependencies():
    """Install Python dependencies."""
    try:
        import fastapi
        import uvicorn
        import google.generativeai
        import sentence_transformers
    except ImportError:
        print("📥 Installing dependencies...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "-r", "requirements.txt"])
        print("✅ Dependencies installed")

def main():
    """Main startup function."""
    print("🚀 Starting Enterprise RAG Demo...")
    print()
    
    # Check for python-dotenv
    try:
        from dotenv import load_dotenv
    except ImportError:
        print("📥 Installing python-dotenv...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "python-dotenv"])
        from dotenv import load_dotenv
    
    # Check environment file
    if not check_env_file():
        sys.exit(1)
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    print("✅ Environment variables loaded")
    print()
    
    # Install dependencies if needed
    install_dependencies()
    
    print()
    print("✅ Setup complete!")
    print()
    print("Starting RAG Demo backend on http://localhost:8001")
    print("Open frontend/index.html in your browser or serve it with:")
    print("  cd frontend && python -m http.server 8080")
    print()
    print("Press Ctrl+C to stop the server")
    print()
    
    # Start the server
    backend_dir = Path(__file__).parent / "backend"
    os.chdir(backend_dir)
    subprocess.run([sys.executable, "-m", "uvicorn", "main:app", "--reload", "--port", "8001"])

if __name__ == "__main__":
    main()

