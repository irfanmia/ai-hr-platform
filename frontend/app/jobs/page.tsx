"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { JobCard } from "@/components/job-card";
import { SiteHeader } from "@/components/site-header";
import { SectionHeading } from "@/components/section-heading";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getJobs } from "@/lib/api";
import type { Job, LocationType } from "@/lib/types";

const locationOptions: LocationType[] = ["remote", "onsite", "hybrid"];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<LocationType[]>([]);
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");

  useEffect(() => {
    // Debounce text inputs by 400ms; location checkboxes fire immediately
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await getJobs({
          search: search || undefined,
          skills: skillSearch || undefined,
          min_experience: experienceMin || undefined,
          max_experience: experienceMax || undefined,
          location_type: selectedLocations.length > 0 ? selectedLocations : undefined,
        });
        setJobs(data);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [experienceMax, experienceMin, search, selectedLocations, skillSearch]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <SectionHeading
          eyebrow="Open Roles"
          title="Find the right role with AI-first hiring."
          description="Search, filter, and apply to active roles with a guided application flow and automated interview scoring."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Filters</span>
                {(selectedLocations.length > 0 || experienceMin || experienceMax || skillSearch) && (
                  <button
                    className="text-xs text-indigo-600 hover:underline"
                    onClick={() => { setSelectedLocations([]); setExperienceMin(""); setExperienceMax(""); setSkillSearch(""); }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <Label>Location Type</Label>
                {locationOptions.map((option) => (
                  <div key={option} className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedLocations.includes(option)}
                      onCheckedChange={(checked) =>
                        setSelectedLocations((current) =>
                          checked ? [...current, option] : current.filter((value) => value !== option)
                        )
                      }
                    />
                    <span className="text-sm capitalize text-slate-600">{option}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Experience Range</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Min" value={experienceMin} onChange={(e) => setExperienceMin(e.target.value)} />
                  <Input placeholder="Max" value={experienceMax} onChange={(e) => setExperienceMax(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Skills Search</Label>
                <Input placeholder="Python, Figma..." value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} />
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                className="h-12 rounded-2xl pl-11"
                placeholder="Search by title, department, or keyword"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="grid gap-5 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-64 rounded-3xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
                {!jobs.length ? <p className="text-sm text-slate-500">No jobs found for the selected filters.</p> : null}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
