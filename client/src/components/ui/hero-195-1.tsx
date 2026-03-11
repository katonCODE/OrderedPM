import { ArrowRight, CheckCircle2, Clock3, KanbanSquare, Sparkles, Users2 } from "lucide-react"
import { Link } from "react-router-dom"

import Navigation from "@/components/Navigation"
import { BorderBeam } from "@/components/ui/border-beam"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TracingBeam } from "@/components/ui/tracing-beam"

const metrics = [
  { label: "Teams aligned", value: "120+" },
  { label: "Tasks shipped", value: "18k" },
  { label: "Planning time saved", value: "11h" },
]

const highlights = [
  {
    title: "AI planning that stays practical",
    description: "Turn goals into clear task sequences, owners, and next actions in seconds.",
    icon: Sparkles,
  },
  {
    title: "Kanban, timeline, and priorities",
    description: "Keep the same work visible across views without rebuilding your workflow.",
    icon: KanbanSquare,
  },
  {
    title: "Collaboration without clutter",
    description: "Share updates, assign work, and keep stakeholders in sync from one workspace.",
    icon: Users2,
  },
]

const workflow = [
  {
    title: "Capture work fast",
    description: "Drop in goals, rough notes, and deadlines. OrderedPM turns them into organized tasks.",
  },
  {
    title: "Let AI shape the plan",
    description: "Balance urgency, effort, and ownership before the team starts execution.",
  },
  {
    title: "Ship with fewer status meetings",
    description: "Everyone sees blockers, progress, and the next best action at a glance.",
  },
]

const gallery = [
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
]

const boardCards = {
  plan: [
    { name: "Launch workspace", status: "Ready", tone: "bg-emerald-500/15 text-emerald-300" },
    { name: "Draft onboarding flow", status: "In review", tone: "bg-amber-500/15 text-amber-300" },
    { name: "Sync API scopes", status: "Blocked", tone: "bg-rose-500/15 text-rose-300" },
  ],
  track: [
    { name: "Daily standup digest", status: "Live", tone: "bg-sky-500/15 text-sky-300" },
    { name: "Sprint burnup", status: "Updated", tone: "bg-violet-500/15 text-violet-300" },
    { name: "Risk watchlist", status: "Watching", tone: "bg-amber-500/15 text-amber-300" },
  ],
  collaborate: [
    { name: "Design feedback", status: "6 comments", tone: "bg-fuchsia-500/15 text-fuchsia-300" },
    { name: "Client approvals", status: "2 pending", tone: "bg-cyan-500/15 text-cyan-300" },
    { name: "Release notes", status: "Shared", tone: "bg-emerald-500/15 text-emerald-300" },
  ],
} as const

const Hero195One = () => {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_24%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.2),transparent_28%),linear-gradient(180deg,#050816_0%,#090d1f_50%,#050816_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(circle_at_center,black,transparent_80%)]" />

      <Navigation />

      <main className="relative z-10 pb-24">
        <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-10 md:px-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pt-16">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Strategy, planning, and execution in one flow
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                The planning workspace that keeps fast-moving teams focused.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                OrderedPM turns scattered requests into structured work, AI-assisted plans, and clean delivery
                updates your team can actually trust.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 rounded-full bg-amber-300 px-6 text-[#111827] hover:bg-amber-200">
                <Link to="/login">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/about">See how it works</Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <Card key={metric.label} className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur">
                  <CardContent className="p-5">
                    <p className="text-2xl font-semibold">{metric.value}</p>
                    <p className="mt-1 text-sm text-white/55">{metric.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="relative">
            <Card className="relative overflow-hidden border-white/10 bg-[#0f172fcc] text-white shadow-2xl shadow-black/40">
              <BorderBeam size={260} duration={14} colorFrom="#fbbf24" colorTo="#a855f7" />
              <CardHeader className="space-y-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl text-white">Launch control</CardTitle>
                    <CardDescription className="text-white/60">
                      Plan, track, and align without opening five tools.
                    </CardDescription>
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                    Live sprint
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white/55">Priority queue</p>
                        <p className="text-lg font-medium">Website relaunch</p>
                      </div>
                      <Clock3 className="h-5 w-5 text-amber-300" />
                    </div>
                    <div className="space-y-3">
                      {[
                        "Clarify landing page copy",
                        "Finalize launch checklist",
                        "Assign release owners",
                      ].map((task) => (
                        <div key={task} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111827] px-3 py-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          <span className="text-sm text-white/80">{task}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-white/55">AI planner</p>
                    <p className="mt-2 text-sm leading-6 text-white/75">
                      Best next move: launch the new landing page, collect signups, and review messaging
                      performance after 48 hours.
                    </p>
                    <div className="mt-5 rounded-xl border border-white/10 bg-[#111827] p-4">
                      <div className="flex items-center gap-2 text-sm text-amber-300">
                        <Sparkles className="h-4 w-4" />
                        Suggested focus
                      </div>
                      <p className="mt-2 text-sm text-white/70">Prioritize conversion copy before adding more roadmap scope.</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {gallery.slice(0, 2).map((image) => (
                    <img
                      key={image}
                      src={image}
                      alt="Team collaboration workspace"
                      className="h-40 w-full rounded-2xl border border-white/10 object-cover"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8 md:px-12">
          <div className="grid gap-5 md:grid-cols-3">
            {highlights.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="border-white/10 bg-white/5 text-white shadow-none backdrop-blur">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <Icon className="h-5 w-5 text-amber-300" />
                  </div>
                  <h2 className="text-lg font-medium">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:px-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
              Built for real project momentum
            </div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Move from rough idea to delivery without losing context.
            </h2>
            <p className="max-w-xl text-base leading-7 text-white/60">
              Use the same system for planning, handoff, progress checks, and launch readiness. That means
              fewer duplicate docs and fewer “what are we doing next?” messages.
            </p>
          </div>

          <TracingBeam className="max-w-none">
            <div className="space-y-6 pl-10 md:pl-16">
              {workflow.map((step, index) => (
                <Card key={step.title} className="border-white/10 bg-white/5 text-white shadow-none">
                  <CardContent className="p-6">
                    <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-300/15 text-sm text-amber-200">
                      {index + 1}
                    </div>
                    <h3 className="text-lg font-medium">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/60">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TracingBeam>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-4 md:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <Card className="border-white/10 bg-white/5 text-white shadow-none">
              <CardHeader>
                <CardTitle className="text-white">One workspace, multiple views</CardTitle>
                <CardDescription className="text-white/60">
                  Switch between planning, tracking, and collaboration without breaking the team rhythm.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="plan" className="w-full">
                  <TabsList className="grid h-auto grid-cols-3 rounded-2xl bg-white/5">
                    <TabsTrigger value="plan">Plan</TabsTrigger>
                    <TabsTrigger value="track">Track</TabsTrigger>
                    <TabsTrigger value="collaborate">Collaborate</TabsTrigger>
                  </TabsList>
                  {Object.entries(boardCards).map(([key, items]) => (
                    <TabsContent key={key} value={key} className="space-y-3 pt-4">
                      {items.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0f172a] px-4 py-4"
                        >
                          <div>
                            <p className="font-medium text-white">{item.name}</p>
                            <p className="text-sm text-white/50">OrderedPM keeps the latest decision visible.</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs ${item.tone}`}>{item.status}</span>
                        </div>
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0f172fcc] text-white shadow-none">
              <CardHeader>
                <CardTitle className="text-white">Get launch-ready updates</CardTitle>
                <CardDescription className="text-white/60">
                  Weekly product notes, planning ideas, and release workflows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <img src={gallery[2]} alt="Product team meeting" className="h-56 w-full object-cover" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="launch-email">Work email</Label>
                  <Input
                    id="launch-email"
                    type="email"
                    placeholder="team@company.com"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
                  />
                </div>
                <Button className="h-11 w-full rounded-full bg-white text-[#0f172a] hover:bg-white/90">
                  Join the waitlist
                </Button>
                <p className="text-xs text-white/45">
                  By joining, you’ll get product updates and early access announcements.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}

export { Hero195One, Hero195One as Hero195 }
