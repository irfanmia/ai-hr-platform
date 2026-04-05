import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Job } from "@/lib/types";

export function JobCard({ job }: { job: Job }) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-white">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-950">{job.title}</h3>
              <p className="text-sm text-slate-500">{job.department}</p>
            </div>
            <Badge>{job.location_type}</Badge>
          </div>
          <p className="text-sm text-slate-600">
            {job.experience_years_min}-{job.experience_years_max} years experience
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {job.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary">
              {skill}
            </Badge>
          ))}
        </div>
        <div className="flex gap-3">
          <Button asChild className="flex-1">
            <Link href={`/apply/${job.id}`}>Apply Now</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/jobs/${job.id}`}>View Role</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
