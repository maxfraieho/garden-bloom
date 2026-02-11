# Glossary

> Terms derived from MANIFESTO.md and codebase evidence

---

| Term | Definition | Source |
|------|-----------|--------|
| **Agentic Digital Garden** | System where knowledge is not passive documents but simultaneously interface, memory, and behavior | MANIFESTO.md, Section 1 |
| **Agent** | Bounded context + defined role + instruction + memory + responsibility. NOT a chatbot. | MANIFESTO.md, Section 2.1 |
| **Folder-as-Agent** | Directory in filesystem that defines an agent's knowledge boundaries, permissions, and visibility | MANIFESTO.md, Section 2.2 |
| **File-as-Instruction** | Markdown file serving as system prompt, reasoning result, memory, or behavior description | MANIFESTO.md, Section 2.2 |
| **Subagent** | Subfolder agent, hierarchically subordinate, inherits/extends parent context | MANIFESTO.md, Section 2.2 |
| **gh-aw** | GitHub Agentic Workflows — universal agent format using YAML frontmatter (config) + Markdown body (logic) | MANIFESTO.md, Section 5 |
| **DRAKON** | Visual logic language that eliminates ambiguity; used for agent logic definition | MANIFESTO.md, Section 6 |
| **drakongen** | Code generator that converts DRAKON diagrams to pseudocode, AST, or prompt structures | `drakongen/src/` |
| **NotebookLM** | Google's cognitive engine used strictly on sources (no hallucination); the system's cognitive core | MANIFESTO.md, Section 4 |
| **Access Zone** | Delegated knowledge context with access controls, time limits, and consent gates | `src/components/zones/`, `src/hooks/useAccessZones.ts` |
| **Knowledge-as-Backend** | Paradigm where Markdown files and folders form an intelligent backend for specialized applications | MANIFESTO.md, Section 1 |
| **Human-in-the-loop** | Principle: agents propose, humans approve. System is extended intelligence, not autopilot. | MANIFESTO.md, Section 8 |
| **Edit Proposal** | Guest-submitted content change that requires owner approval before being applied | `src/lib/api/mcpGatewayClient.ts` |
| **MCP** | Model Context Protocol — protocol for agent communication with the gateway | `src/types/mcpGateway.ts` |
| **Owner** | Authenticated user who controls the garden, approves changes, manages zones | `src/hooks/useOwnerAuth.tsx` |
| **Guest** | Unauthenticated visitor accessing a delegated zone via access code | Zone consent gate flow |
| **Wikilinks** | `[[...]]` internal linking syntax (Obsidian-compatible) | `src/lib/notes/wikilinkParser.ts` |
| **Link Graph** | Visual representation of note interconnections | `src/lib/notes/linkGraph.ts` |
| **Zettelkasten** | Note-taking method based on atomic, interconnected notes; the human input workflow | MANIFESTO.md, Section 1 |
| **Safe Outputs** | gh-aw mechanism: structured write operations (create-issue, create-pull-request, add-comment) replacing direct write permissions. Maps to human-in-the-loop: agent proposes via safe-output, system/human approves. | `gh-aw/.github/aw/github-agentic-workflows.md` |
| **Safe Inputs** | gh-aw mechanism: custom lightweight MCP tools defined inline with `script:` (JS), `run:` (shell), or `py:` (Python). Gives agents read-only data access without full tool permissions. | `gh-aw/.github/aw/github-agentic-workflows.md` |
| **gh-aw Skill** | Reusable knowledge module at `skills/<name>/SKILL.md`. Provides domain-specific instructions an agent can reference. Maps to manifesto's File-as-Instruction. | `gh-aw/skills/` |
| **AWF (Agent Workflow Firewall)** | Network egress control for AI agents. Domain-based access controls and activity logging for secure workflow execution. | `gh-aw/README.md`, `github/gh-aw-firewall` |
| **MCP Gateway (gh-aw)** | Routes MCP server calls through unified HTTP gateway for centralized access management. Complements project's MCP Protocol implementation. | `gh-aw/README.md`, `github/gh-aw-mcpg` |
| **gh-aw Workflow** | Markdown file with YAML frontmatter (triggers, permissions, tools, safe-outputs) + natural language body (instructions). Compiles to `.lock.yml` for GitHub Actions execution. | `gh-aw/.github/workflows/` |
| **gh-aw Agent** | Agent definition at `.github/agents/<name>.md`. YAML frontmatter: `name`, `description`, `tools[]`, `infer` (model). Body: natural language instructions. | `gh-aw/.github/agents/` |

---

*Updated: 2026-02-11*
