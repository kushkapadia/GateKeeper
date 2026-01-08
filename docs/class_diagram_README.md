# GateKeeper Class Diagram Documentation

## Overview

This document describes the UML class diagram for the GateKeeper project. The diagram follows standard UML 2.5 conventions and provides a comprehensive view of the system's architecture.

## Files

1. **`class_diagram.puml`** - PlantUML source file (recommended for detailed viewing)
2. **`class_diagram.md`** - Markdown file with Mermaid diagram (for GitHub/GitLab rendering)

## UML Conventions Used

### 1. Visibility Modifiers
- **`+`** - Public (accessible from anywhere)
- **`-`** - Private (only accessible within the class)
- **`#`** - Protected (accessible within class and subclasses)

### 2. Stereotypes
- **`<<BaseModel>>`** - Pydantic BaseModel classes (data models)
- **`<<utility>>`** - Utility classes/modules with static functions
- **`<<application>>`** - Main application class
- **`<<server>>`** - Server component
- **`<<enumeration>>`** - Enumeration type

### 3. Relationship Types

#### Dependency (..>)
- Used when one class uses another but doesn't own it
- Example: `FastAPIApplication ..> PolicyEvaluator : uses`
- Indicates a "uses-a" relationship

#### Composition (*--)
- Used when one class contains another and the contained class cannot exist without the container
- Example: `EnforcementResponse *-- TraceItem : contains`
- Indicates a "has-a" relationship with strong ownership

#### Association (-->)
- Used for general relationships
- Example: `EnforcementRequest --> Stage : uses`
- Indicates a "uses-a" relationship

### 4. Package Organization

The diagram is organized into logical packages representing the project structure:

- **backend.app.models** - Data transfer objects (DTOs)
- **backend.app.core** - Core infrastructure and configuration
- **backend.app.auth** - Authentication and authorization
- **backend.app.policies** - Policy management and evaluation
- **backend.app.audit** - Audit logging
- **backend.app** - Main FastAPI application
- **mcp.server** - MCP server for policy tools
- **rag_demo.backend** - Demo RAG engine components
- **sdk.python.gatekeeper_sdk** - Python SDK client

## Key Classes and Their Responsibilities

### Models Package
- **EnforcementRequest**: Request model for policy enforcement
- **EnforcementResponse**: Response model containing decision and trace
- **TraceItem**: Individual policy execution trace entry
- **Stage**: Enumeration of enforcement stages

### Core Package
- **Settings**: Application configuration (singleton pattern)
- **RedisClient**: Redis connection management

### Auth Package
- **AuthModule**: Authentication utilities (JWT, password hashing)

### Policies Package
- **PolicyEvaluator**: Main policy evaluation engine
- **PolicyRepository**: Database access for policies
- **PolicyDescriptor**: Schema descriptor management
- **PolicyValidator**: Policy validation against schemas
- **PolicyContextBuilder**: Builds policy context for LLM prompts
- **PolicyActions**: Policy action implementations (block, rewrite, filter)
- **PathResolver**: Path resolution and expression evaluation

### Main Application
- **FastAPIApplication**: Main FastAPI application with REST endpoints

## Design Patterns Identified

1. **Repository Pattern**: `PolicyRepository` abstracts database access
2. **Strategy Pattern**: `PolicyActions` provides different action strategies
3. **Factory Pattern**: `PolicyContextBuilder` creates policy contexts
4. **Singleton Pattern**: `Settings` provides global configuration
5. **Utility Pattern**: Most policy modules use static utility functions

## How to View the Diagram

### Option 1: PlantUML (Recommended)
1. Install PlantUML extension in VS Code or IntelliJ IDEA
2. Open `class_diagram.puml`
3. Preview using the PlantUML extension

### Option 2: Online PlantUML Editor
1. Visit http://www.plantuml.com/plantuml/uml/
2. Copy contents of `class_diagram.puml`
3. Paste and render

### Option 3: Mermaid (GitHub/GitLab)
1. View `class_diagram.md` on GitHub/GitLab
2. Mermaid diagrams render automatically

## Relationship Summary

### Main Flow
```
FastAPIApplication
  ├── Uses EnforcementRequest/Response (data models)
  ├── Uses PolicyEvaluator (evaluation)
  │   ├── Uses PolicyRepository (data access)
  │   ├── Uses PolicyActions (actions)
  │   └── Uses PathResolver (path resolution)
  ├── Uses PolicyValidator (validation)
  │   └── Uses PolicyDescriptor (schema)
  └── Uses AuthModule (authentication)
```

### RAG Demo Flow
```
GatekeeperMode
  ├── Uses RAGEngine (retrieval)
  └── Uses GateKeeperClient (API calls)
      └── HTTP calls to FastAPIApplication
```

## Notes

- Most policy modules are implemented as utility classes with static methods (Python module pattern)
- The diagram represents the logical structure, not the exact Python implementation
- External dependencies (FastAPI, psycopg, redis) are not shown but are used by the classes
- The RAG demo components are separate from the main GateKeeper backend

## Maintenance

When adding new classes:
1. Add them to the appropriate package
2. Use appropriate stereotypes
3. Add relationships with proper UML notation
4. Update this documentation if needed

