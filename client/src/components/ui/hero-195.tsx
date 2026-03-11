"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { FolderKanban, Github, LayoutDashboard, ListTodo } from "lucide-react"
import { Link } from "react-router-dom"

import { BorderBeam } from "@/components/ui/border-beam"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const previewTabs = {
  dashboard: {
    alt: "OrderedPM dashboard preview placeholder",
    label: "Dashboard",
    src: "/images/Dashboard.webp",
  },
  taskView: {
    alt: "OrderedPM task view preview placeholder",
    label: "Task View",
    src: "/images/TaskView.webp",
  },
  projectView: {
    alt: "OrderedPM project view preview placeholder",
    label: "Project View",
    src: "/images/ProjectView.webp",
  },
} as const

export const Hero195 = () => {
  const [activeTab, setActiveTab] = useState<keyof typeof previewTabs>("dashboard")
  const activePreview = previewTabs[activeTab]

  return (
    <section className="relative overflow-hidden bg-[#1a1a1a] py-24 text-[#e0e0e0] lg:py-32">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1a1a1a] via-transparent to-[#1a1a1a]" />
      <div className="container relative z-10 mx-auto px-4">
        <div className="flex flex-col items-center text-center">
          <div className="flex flex-col items-center">
            <span className="mb-2 text-[10px] uppercase tracking-[0.3em] text-gray-500">created by:</span>
            <motion.a
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              href="https://github.com/katonCODE"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm font-medium text-[#e0e0e0] transition hover:border-amber-400/40 hover:bg-white/[0.08]"
            >
              <span>github.com/katonCODE</span>
              <Github className="ml-2 h-4 w-4 text-amber-400" />
            </motion.a>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 max-w-4xl text-5xl font-extrabold tracking-tight lg:text-7xl"
          >
            <span className="relative inline-block pb-3 text-amber-400">
              OrderedPM
              <svg
                viewBox="0 0 240 18"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="absolute -bottom-1 left-0 h-3 w-full"
              >
                <path
                  d="M4 10c36 6 67 2 101 0 42-3 79-5 131-1"
                  stroke="#D4AF37"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.65"
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400"
          >
            A project management tool I built because I couldn't find one that actually helped me finish my
            assignments on time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <Button asChild size="lg" className="h-12 bg-amber-400 px-8 text-[#1a1a1a] hover:bg-amber-300">
              <Link to="/login">Get Started</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/10 bg-white/[0.04] px-8 text-[#e0e0e0] hover:bg-white/[0.08] hover:text-[#e0e0e0]"
            >
              <Link to="/about">About Me</Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-14 w-full"
          >
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as keyof typeof previewTabs)}>
              <TabsList className="mx-auto inline-flex h-auto rounded-full border border-white/10 bg-white/[0.04] p-1">
                <TabsTrigger
                  value="dashboard"
                  className="gap-2 rounded-full px-5 py-2.5 text-sm text-gray-300 data-[state=active]:bg-amber-400 data-[state=active]:text-[#1a1a1a] data-[state=active]:shadow-[0_8px_24px_rgba(212,175,55,0.25)]"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger
                  value="projectView"
                  className="gap-2 rounded-full px-5 py-2.5 text-sm text-gray-300 data-[state=active]:bg-amber-400 data-[state=active]:text-[#1a1a1a] data-[state=active]:shadow-[0_8px_24px_rgba(212,175,55,0.25)]"
                >
                  <FolderKanban className="h-4 w-4" />
                  Project View
                </TabsTrigger>
                <TabsTrigger
                  value="taskView"
                  className="gap-2 rounded-full px-5 py-2.5 text-sm text-gray-300 data-[state=active]:bg-amber-400 data-[state=active]:text-[#1a1a1a] data-[state=active]:shadow-[0_8px_24px_rgba(212,175,55,0.25)]"
                >
                  <ListTodo className="h-4 w-4" />
                  Task View
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="relative mt-20 rounded-xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/40"
        >
          <BorderBeam size={250} duration={12} delay={9} colorFrom="#D4AF37" colorTo="#333333" />
          <div className="overflow-hidden rounded-lg">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeTab}
                src={activePreview.src}
                alt={activePreview.alt}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="aspect-video w-full object-cover"
              />
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  )
}