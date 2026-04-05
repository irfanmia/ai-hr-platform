export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-600">{eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
      <p className="max-w-2xl text-base text-slate-600">{description}</p>
    </div>
  );
}
