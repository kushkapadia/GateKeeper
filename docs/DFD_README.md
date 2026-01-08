# Data Flow Diagrams (DFD) - Quick Reference

## Files Created

### PlantUML Source Files (Recommended for High-Quality Rendering)
1. **`dfd_level0.puml`** - Context Diagram (Level 0)
2. **`dfd_level1.puml`** - Top-Level DFD (Level 1)
3. **`dfd_level2.puml`** - Enforce Policy Process Detail (Level 2)

### Documentation Files
1. **`dfd_documentation.md`** - Comprehensive documentation with all DFDs, data dictionary, and process specifications
2. **`dfd_all_levels.md`** - Combined document with all three levels, suitable for research paper inclusion

## Quick Start

### Viewing the Diagrams

#### Option 1: PlantUML (Best Quality)
1. Install PlantUML extension in VS Code or IntelliJ IDEA
2. Open any `.puml` file
3. Use preview/export to generate PNG/SVG

#### Option 2: Online PlantUML Editor
1. Visit http://www.plantuml.com/plantuml/uml/
2. Copy contents of `.puml` file
3. Paste and render
4. Export as PNG/SVG for paper inclusion

#### Option 3: Mermaid (GitHub/GitLab)
- View `dfd_all_levels.md` on GitHub/GitLab
- Mermaid diagrams render automatically

## For Research Paper

### Recommended Usage

1. **Level 0 (Context Diagram)**: Include in "System Overview" or "Architecture" section
   - Shows system boundaries
   - Demonstrates external interactions
   - Suitable for introduction

2. **Level 1 (Top-Level DFD)**: Include in "System Design" or "Architecture" section
   - Shows major functional decomposition
   - Demonstrates data stores
   - Suitable for methodology/design section

3. **Level 2 (Enforce Policy Detail)**: Include in "Detailed Design" or "Implementation" section
   - Shows detailed process flow
   - Demonstrates internal data flows
   - Suitable for detailed analysis

### Export for Paper

1. **High Resolution**: Use PlantUML to export as PNG (300 DPI) or SVG
2. **Vector Format**: SVG is preferred for papers (scalable, no pixelation)
3. **Caption Format**: 
   ```
   Figure X: GateKeeper System - Level 0 Context Diagram
   ```

### Citation in Paper

When referencing the DFDs:

> "The system architecture is modeled using hierarchical Data Flow Diagrams (DFD) following standard Software Engineering conventions [Yourdon & DeMarco, 1979]. The Level 0 context diagram (Figure X) shows system boundaries, Level 1 (Figure Y) decomposes major processes, and Level 2 (Figure Z) provides detailed process flows for policy enforcement."

## DFD Standards Compliance

All diagrams follow standard Software Engineering DFD conventions:

✅ **Conservation of Data**: Data flows balanced between levels  
✅ **No Black Holes**: Every process has outputs  
✅ **No Miracles**: Every process has inputs  
✅ **Unique Names**: All flows and stores uniquely named  
✅ **Hierarchical Numbering**: Processes numbered (1.0, 2.0, 2.1, etc.)  
✅ **Data Store Numbering**: Stores numbered (D1, D2, D3, D4)  
✅ **Unidirectional Flows**: All data flows are unidirectional  
✅ **Verb-Noun Format**: Process names use verb-noun format  
✅ **Labeled Flows**: All data flows are labeled  

## Diagram Elements

### Level 0
- **1 Process**: GateKeeper System
- **4 External Entities**: RAG Application, Policy Author, Auditor, System Administrator
- **10 Data Flows**: Bidirectional flows between system and entities

### Level 1
- **5 Processes**: Authenticate User, Enforce Policy, Manage Policies, Generate Audit Reports, Manage Schema Descriptors
- **4 Data Stores**: Policies DB, Schema DB, Audit Log DB, Redis Cache
- **3 External Entities**: RAG Application, Policy Author, Auditor

### Level 2
- **6 Sub-Processes**: Validate Request, Fetch Policies, Evaluate Conditions, Execute Actions, Build Policy Context, Log Audit Event
- **2 Temporary Stores**: Temporary Context, Policy Results
- **4 External Data Stores**: Policies DB, Schema DB, Audit Log DB, Redis Cache

## Key Features for Research

1. **Standard Notation**: Follows Yourdon/DeMarco and Gane/Sarson conventions
2. **Complete Coverage**: All three levels provided
3. **Data Dictionary**: Complete data structure definitions
4. **Process Specifications**: Detailed process logic documented
5. **Validation**: All DFD rules verified

## Maintenance

When updating DFDs:
1. Maintain data flow balance between levels
2. Update data dictionary if data structures change
3. Update process specifications if logic changes
4. Verify all DFD rules are still satisfied
5. Update revision history in documentation

## References

- Yourdon, E., & DeMarco, T. (1979). *Structured Analysis and System Specification*
- Gane, C., & Sarson, T. (1979). *Structured Systems Analysis: Tools and Techniques*
- IEEE Std 1016-2009: *IEEE Standard for Information Technology—Systems Design—Software Design Descriptions*

