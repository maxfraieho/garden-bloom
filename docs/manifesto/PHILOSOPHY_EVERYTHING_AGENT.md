# Philosophy: Everything is an Agent

> Derived from: MANIFESTO.md, Sections 2-3

---

## Core Principle

**Everything is an agent.** But an agent is not a chatbot.

An agent is:
- a bounded context
- a defined role
- an instruction for action
- memory
- responsibility

## Mapping to Filesystem

| Filesystem Entity | Agent Concept | Behavior |
|-------------------|---------------|----------|
| **Folder** | Agent / Agent Container | Defines knowledge boundaries, permissions, visibility context |
| **File** (Markdown) | Instruction / Logic / Memory | System prompt, reasoning result, accumulated memory, behavior description |
| **Subfolder** | Subagent | Hierarchically subordinate, inherits/extends parent context |

> If a folder has no explicit agent file, it is still a default agent (read-only knowledge agent).

## Context is Not a Prompt

Context:
- is not passed fully into the model
- is not "stuffed" into a single message
- is explored by the agent incrementally

The agent:
- **looks into the folder**
- reads files
- makes relevance choices
- acts as a researcher, not a calculator

This is implemented through:
- MinIO / file zones
- RAG
- NotebookLM as strict cognitive layer

## Knowledge-Action Duality

- **Knowledge without agent = dead** (static documents nobody acts on)
- **Agent without context = harmful** (hallucination, no grounding)

The system creates the bridge: knowledge structures become agent behavior through folder-as-context mapping.

## Design Principles

1. Knowledge > UI
2. Simplicity of structure > "clever" abstractions
3. Markdown = the primary contract
4. Agent without context is harmful
5. Context without agent is dead

---

## Mapping to gh-aw (GitHub Agentic Workflows)

The gh-aw framework provides the **concrete implementation format** for the manifesto's agent concepts:

| Manifesto Concept | gh-aw Implementation | Evidence |
|-------------------|---------------------|----------|
| **Agent** | `.github/agents/<name>.md` — YAML frontmatter (config) + Markdown body (instructions) | `gh-aw/.github/agents/` |
| **Folder-as-Agent** | Each folder's `_agent.md` defines its agent identity; gh-aw agents live in `.github/agents/` | Adaptation needed for project's folder-per-agent structure |
| **File-as-Instruction** | Markdown body = natural language instructions. Skills = `skills/<name>/SKILL.md` | `gh-aw/skills/` (24+ modules) |
| **Context is Not a Prompt** | gh-aw agents receive context from repo, issues, PRs — not stuffed into prompt | gh-aw spec: context access via tools |
| **Human-in-the-loop** | **Safe-outputs**: agent proposes structured actions (create-issue, add-comment), system/human approves | `gh-aw/.github/aw/github-agentic-workflows.md` |
| **Knowledge-Action Duality** | Knowledge = Markdown files. Action = agent tools (bash, edit, github, web-fetch). Bridge = gh-aw compilation | gh-aw spec: tools section |

### Key Adaptation for Agentic Digital Garden

gh-aw is designed for GitHub Actions. Our adaptation:
1. **Agent definitions** live inside note folders (`_agent.md`) instead of `.github/agents/`
2. **Safe-outputs** map to our Edit Proposals system (guest proposes, owner approves)
3. **Skills** map to our DRAKON pseudocode exports (visual logic → reusable agent instruction)
4. **Tools** include NotebookLM (grounded AI) as primary cognitive tool, not just bash/edit/github
5. **Compilation target** is not GitHub Actions but our Worker + Backend execution pipeline

---

*Source: MANIFESTO.md, Sections 2, 3, 9; gh-aw reference at `gh-aw/`*
