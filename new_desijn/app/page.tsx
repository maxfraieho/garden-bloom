"use client"

import { useState } from "react"
import { Search, Sun, Moon, Network, Tag, FileText, Link2, Calendar, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Mock data for demonstration
const mockNotes = [
  {
    id: 1,
    title: "Building Second Brain",
    content: "A method for saving and organizing ideas...",
    tags: ["productivity", "learning"],
    backlinks: 3,
    date: "2024-01-08",
  },
  {
    id: 2,
    title: "Zettelkasten Method",
    content: "A knowledge management system based on...",
    tags: ["learning", "knowledge-mgmt"],
    backlinks: 5,
    date: "2024-01-07",
  },
  {
    id: 3,
    title: "Networked Thinking",
    content: "The practice of connecting ideas across...",
    tags: ["thinking", "learning"],
    backlinks: 2,
    date: "2024-01-06",
  },
  {
    id: 4,
    title: "Digital Minimalism",
    content: "A philosophy of technology use that...",
    tags: ["productivity", "lifestyle"],
    backlinks: 1,
    date: "2024-01-05",
  },
  {
    id: 5,
    title: "Atomic Habits",
    content: "Small changes lead to remarkable results...",
    tags: ["habits", "productivity"],
    backlinks: 4,
    date: "2024-01-04",
  },
]

const mockTags = [
  { name: "productivity", count: 12 },
  { name: "learning", count: 18 },
  { name: "knowledge-mgmt", count: 7 },
  { name: "thinking", count: 9 },
  { name: "lifestyle", count: 5 },
  { name: "habits", count: 8 },
  { name: "creativity", count: 6 },
  { name: "writing", count: 11 },
]

const mockBacklinks = [
  {
    from: "Personal Knowledge Management",
    to: "Building Second Brain",
    preview: "This connects to [[Building Second Brain]] methodology...",
  },
  {
    from: "Note-taking Systems",
    to: "Zettelkasten Method",
    preview: "The [[Zettelkasten Method]] is a powerful approach...",
  },
  {
    from: "Creative Process",
    to: "Networked Thinking",
    preview: "Embracing [[Networked Thinking]] enhances creativity...",
  },
]

export default function DigitalGarden() {
  const [isDark, setIsDark] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)

  const filteredNotes = mockNotes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-garden-cream dark:bg-garden-charcoal transition-colors duration-300">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-garden-border bg-garden-paper dark:bg-garden-dark-paper backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-garden-forest" />
                <h1 className="font-serif text-2xl font-bold text-garden-forest dark:text-garden-teal">
                  Digital Garden
                </h1>
              </div>

              {/* Inline Search */}
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-garden-muted" />
                <Input
                  type="text"
                  placeholder="Search notes and ideas..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowSearchResults(e.target.value.length > 0)
                  }}
                  className="pl-10 bg-garden-cream dark:bg-garden-charcoal border-garden-border focus:border-garden-forest focus:ring-garden-forest"
                />
                {/* Search Results Dropdown */}
                {showSearchResults && searchQuery && (
                  <div className="absolute top-full mt-2 w-full rounded-lg border border-garden-border bg-garden-paper dark:bg-garden-dark-paper shadow-lg animate-fade-in">
                    <div className="max-h-96 overflow-y-auto p-2">
                      {filteredNotes.length > 0 ? (
                        filteredNotes.map((note) => (
                          <button
                            key={note.id}
                            className="w-full rounded-md p-3 text-left transition-colors hover:bg-garden-cream dark:hover:bg-garden-charcoal"
                          >
                            <div className="font-medium text-garden-forest dark:text-garden-teal">{note.title}</div>
                            <div className="mt-1 text-sm text-garden-muted line-clamp-1">{note.content}</div>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-garden-muted">No notes found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsDark(!isDark)}
                  className="border-garden-border hover:bg-garden-cream dark:hover:bg-garden-charcoal"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4 text-garden-amber" />
                  ) : (
                    <Moon className="h-4 w-4 text-garden-forest" />
                  )}
                </Button>
                <Button className="bg-garden-forest hover:bg-garden-forest/90 text-white">
                  <Network className="mr-2 h-4 w-4" />
                  View Graph
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sidebar */}
            <aside className="lg:col-span-3 space-y-6 animate-fade-in">
              {/* Browse by Tags */}
              <Card className="bg-garden-paper dark:bg-garden-dark-paper border-garden-border">
                <CardHeader>
                  <CardTitle className="font-serif text-garden-forest dark:text-garden-teal flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Browse by Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {mockTags.map((tag) => (
                      <Badge
                        key={tag.name}
                        variant="secondary"
                        className="cursor-pointer bg-garden-amber/20 hover:bg-garden-amber/30 text-garden-forest dark:text-garden-teal border-0 transition-colors"
                      >
                        {tag.name} <span className="ml-1 text-xs text-garden-muted">({tag.count})</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Graph Preview */}
              <Card className="bg-garden-paper dark:bg-garden-dark-paper border-garden-border">
                <CardHeader>
                  <CardTitle className="font-serif text-garden-forest dark:text-garden-teal flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Knowledge Map
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative aspect-square rounded-lg bg-garden-cream dark:bg-garden-charcoal p-4">
                    <svg className="h-full w-full" viewBox="0 0 200 200">
                      {/* Simple graph visualization preview */}
                      <circle
                        cx="100"
                        cy="100"
                        r="8"
                        fill="currentColor"
                        className="text-garden-forest dark:text-garden-teal"
                      />
                      <circle cx="60" cy="60" r="6" fill="currentColor" className="text-garden-amber" />
                      <circle cx="140" cy="60" r="6" fill="currentColor" className="text-garden-amber" />
                      <circle cx="60" cy="140" r="6" fill="currentColor" className="text-garden-amber" />
                      <circle cx="140" cy="140" r="6" fill="currentColor" className="text-garden-amber" />
                      <line
                        x1="100"
                        y1="100"
                        x2="60"
                        y2="60"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-garden-muted"
                      />
                      <line
                        x1="100"
                        y1="100"
                        x2="140"
                        y2="60"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-garden-muted"
                      />
                      <line
                        x1="100"
                        y1="100"
                        x2="60"
                        y2="140"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-garden-muted"
                      />
                      <line
                        x1="100"
                        y1="100"
                        x2="140"
                        y2="140"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-garden-muted"
                      />
                    </svg>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4 border-garden-border hover:bg-garden-cream dark:hover:bg-garden-charcoal bg-transparent"
                  >
                    Explore Full Graph
                  </Button>
                </CardContent>
              </Card>
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-9 space-y-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
              {/* Recent Notes */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-2xl font-bold text-garden-forest dark:text-garden-teal flex items-center gap-2">
                    <Calendar className="h-6 w-6" />
                    Recent Notes
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {mockNotes.map((note, index) => (
                    <Card
                      key={note.id}
                      className="bg-garden-paper dark:bg-garden-dark-paper border-garden-border hover:shadow-md transition-shadow cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardHeader>
                        <CardTitle className="font-serif text-garden-forest dark:text-garden-teal">
                          {note.title}
                        </CardTitle>
                        <CardDescription className="text-garden-muted">{note.date}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-garden-text dark:text-garden-light-text mb-3 leading-relaxed">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-1">
                            {note.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs bg-garden-amber/20 text-garden-forest dark:text-garden-teal border-0"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-garden-muted">
                            <Link2 className="h-3 w-3" />
                            {note.backlinks}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Connected Thoughts (Backlinks) */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-2xl font-bold text-garden-forest dark:text-garden-teal flex items-center gap-2">
                    <TrendingUp className="h-6 w-6" />
                    Connected Thoughts
                  </h2>
                </div>
                <Card className="bg-garden-paper dark:bg-garden-dark-paper border-garden-border">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {mockBacklinks.map((link, index) => (
                        <div key={index} className="border-l-2 border-garden-forest dark:border-garden-teal pl-4 py-2">
                          <div className="flex items-start gap-2 mb-1">
                            <Link2 className="h-4 w-4 mt-1 text-garden-forest dark:text-garden-teal flex-shrink-0" />
                            <div>
                              <div className="font-medium text-sm text-garden-forest dark:text-garden-teal">
                                {link.from} → {link.to}
                              </div>
                              <p className="text-sm text-garden-text dark:text-garden-light-text leading-relaxed mt-1">
                                {link.preview.split("[[").map((part, i) => {
                                  if (i === 0) return part
                                  const [linkText, rest] = part.split("]]")
                                  return (
                                    <span key={i}>
                                      <span className="text-garden-forest dark:text-garden-teal underline decoration-dotted cursor-pointer hover:bg-garden-amber/20 px-1 rounded">
                                        {linkText}
                                      </span>
                                      {rest}
                                    </span>
                                  )
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            </main>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-garden-border bg-garden-paper dark:bg-garden-dark-paper mt-12">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between text-sm text-garden-muted">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>234 notes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  <span>48 tags</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  <span>567 connections</span>
                </div>
              </div>
              <div>Last updated: January 2024</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
