"use client";

/**
 * /demo — public "Book a demo" contact form.
 *
 * Lives at the same URL the landing page's CTA points to (replacing the
 * old mailto:hello@hireparrot.com link). On submit, POSTs to the Django
 * backend which:
 *   - persists the request,
 *   - emails hello@hireparrot.com via AWS SES with the form payload,
 *   - sends an auto-reply to the enquirer.
 *
 * The form uses the platform's design system (Mulish + brand-green palette
 * via Tailwind) so it sits cleanly under the SiteHeader without needing
 * the landing-only stylesheet.
 */
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PhoneInput } from "@/components/phone-input";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { friendlyDemoError, submitDemoRequest } from "@/lib/api";

interface FormState {
  name: string;
  email: string;
  company: string;
  designation: string;
  phone: string;
  message: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  company: "",
  designation: "",
  phone: "",
  message: "",
};

export default function DemoPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitDemoRequest(form);
      setDone(true);
    } catch (err) {
      setError(friendlyDemoError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-68px)] bg-slate-50 px-6 py-14 sm:py-20">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* ── Left rail: pitch ──────────────────────────────────────── */}
          <section className="flex flex-col gap-6">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Book a demo
            </span>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              See HireParrot screen
              <br />
              <span className="text-emerald-600">300 candidates</span> in
              <br />
              an afternoon.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-slate-600">
              30-minute walkthrough. We'll show you the interview flow your
              candidates take, the AI-graded report your team receives, and
              the embed snippet that drops onto your existing careers page.
            </p>
            <ul className="mt-2 space-y-3 text-sm text-slate-700">
              {[
                "Built for hiring teams from startups to multinationals",
                "Self-host, BYO AI key, or fully-managed SaaS",
                "Identity-verified, fraud-resistant, signed PDF reports",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-auto pt-6 text-xs text-slate-500">
              Prefer email?{" "}
              <a
                href="mailto:hello@hireparrot.com"
                className="font-medium text-slate-700 underline underline-offset-4"
              >
                hello@hireparrot.com
              </a>
            </p>
          </section>

          {/* ── Right rail: form / success ───────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
            {done ? <SuccessCard /> : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-xl font-semibold text-slate-900">
                  Tell us about your team
                </h2>
                <p className="text-sm text-slate-500">
                  We'll get back within one business day.
                </p>

                <Field label="Full name" required>
                  <Input
                    autoComplete="name"
                    placeholder="Aanya Bhatt"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Work email" required>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="aanya@acme.com"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Phone" required>
                    <PhoneInput
                      value={form.phone}
                      onChange={(v) => update("phone", v)}
                      placeholder="9876543210"
                      required
                    />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Company" required>
                    <Input
                      autoComplete="organization"
                      placeholder="Acme Inc."
                      value={form.company}
                      onChange={(e) => update("company", e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Designation" required>
                    <Input
                      autoComplete="organization-title"
                      placeholder="Head of People"
                      value={form.designation}
                      onChange={(e) => update("designation", e.target.value)}
                      required
                    />
                  </Field>
                </div>

                <Field label="Anything we should know? (optional)">
                  <Textarea
                    rows={3}
                    placeholder="Roles you're hiring for, expected volume, integrations you care about…"
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                  />
                </Field>

                {error && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Request a demo"
                  )}
                </Button>

                <p className="text-center text-xs text-slate-400">
                  By submitting you agree to be contacted about HireParrot.
                  We never share your details with third parties.
                </p>
              </form>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500" aria-hidden>*</span>}
      </Label>
      {children}
    </div>
  );
}

function SuccessCard() {
  return (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900">
        Thanks — we've got it.
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-slate-600">
        Someone from our team will reach out within one business day to set
        up your walkthrough. We've also sent a confirmation to your inbox.
      </p>
      <div className="mt-3 flex gap-3">
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild>
          <Link href="/jobs">Explore jobs</Link>
        </Button>
      </div>
    </div>
  );
}
