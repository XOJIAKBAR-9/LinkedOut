import { REACTION_TYPES } from "@linkedout/shared";
import { DoorOpen, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { Page } from "@/components/Page";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { POST_TYPE_META } from "@/features/feed/postTypes";
import { REACTION_META } from "@/features/feed/reactions";

/**
 * Living reference for the "Exit interview" design system. Everything here is rendered
 * with the real tokens and components, so it can't drift from the app. Not translated:
 * it's a developer page.
 */
const COLORS = [
  ["background", "Page"],
  ["card", "Card"],
  ["muted", "Raised / fill"],
  ["border", "Hairline"],
  ["foreground", "Ink text"],
  ["muted-foreground", "Secondary text"],
  ["primary", "Redline (actions, quit)"],
  ["accent", "Redline wash"],
  ["highlight", "Highlighter (warnings, reasons)"],
  ["warning", "Warning text"],
  ["success", "Freedom green"],
  ["destructive", "Destructive"],
] as const;

const TYPE_SCALE = [
  ["text-4xl font-display font-semibold", "36 · Display", "Two years. Then I left."],
  ["text-3xl font-display font-semibold italic", "30 · Display italic", "Families pay overtime."],
  ["text-2xl font-display font-semibold", "24 · H1", "Most warned about"],
  ["text-xl font-display font-semibold", "20 · H2", "Why people are leaving"],
  ["text-lg font-medium", "17 · H3 / lead", "Отработано: 2 года 3 мес."],
  ["text-base", "15 · Body", "Oʻzbekcha matn ham chiroyli koʻrinishi kerak — ʻ va ʼ belgilari bilan."],
  ["text-sm text-muted-foreground", "13 · Small", "Secondary text, meta, captions."],
  ["label-mono text-muted-foreground", "11 · Mono label", "Company · Time served"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t pt-8">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function StyleGuidePage() {
  return (
    <Page title="Style guide">
      <div className="container max-w-5xl space-y-10 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Logo />
            <h1 className="mt-4 font-display text-4xl font-semibold italic">Exit interview</h1>
            <p className="max-w-xl text-muted-foreground">
              Redline on paper. Honest, a little rebellious, trustworthy. Dark ink is the primary theme; light is warm paper.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-md border p-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <Section title="Colour tokens">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {COLORS.map(([token, use]) => (
              <div key={token} className="overflow-hidden rounded-md border">
                <div className="h-14 border-b" style={{ background: `hsl(var(--${token}))` }} />
                <div className="p-2">
                  <p className="font-mono text-xs">--{token}</p>
                  <p className="text-xs text-muted-foreground">{use}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">All text pairs meet WCAG AA (4.5:1). Highlighter is always paired with ink text.</p>
        </Section>

        <Section title="Type">
          <p className="text-sm text-muted-foreground">Source Serif 4 (display) · IBM Plex Sans (UI) · IBM Plex Mono (structured data). All include Cyrillic and Latin Extended.</p>
          <div className="divide-y rounded-lg border bg-card">
            {TYPE_SCALE.map(([cls, label, sample]) => (
              <div key={label} className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr] sm:items-baseline">
                <span className="font-mono text-xs text-muted-foreground">{label}</span>
                <span className={cls}>{sample}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Spacing, radius, elevation">
          <div className="flex flex-wrap items-end gap-3">
            {[1, 2, 3, 4, 6, 8, 12].map((n) => (
              <div key={n} className="text-center">
                <div className="bg-primary" style={{ width: `${n * 4}px`, height: `${n * 4}px` }} />
                <span className="font-mono text-xs text-muted-foreground">{n * 4}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            4px grid. Radius: 3px stamps · 6px controls and cards · full for avatars and reaction pills. Elevation is borders, not shadows;
            only menus and dialogs cast a shadow.
          </p>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button>Publish my exit</Button>
            <Button variant="outline">Cancel</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Delete</Button>
            <Button size="icon" aria-label="Search"><Search /></Button>
            <Button disabled>Disabled</Button>
          </div>
          <p className="text-sm text-muted-foreground">One redline button per view. Tab through to see focus rings.</p>
        </Section>

        <Section title="Inputs">
          <div className="grid max-w-xl gap-4">
            <div className="space-y-1.5"><Label htmlFor="sg-company">Company *</Label><Input id="sg-company" placeholder="Quillstone Labs" /></div>
            <div className="space-y-1.5">
              <Label htmlFor="sg-err">Company *</Label>
              <Input id="sg-err" aria-invalid aria-describedby="sg-err-msg" />
              <p id="sg-err-msg" className="text-sm text-destructive">Name the company</p>
            </div>
            <div className="space-y-1.5"><Label htmlFor="sg-story">Your story</Label><Textarea id="sg-story" placeholder="What happened, and what finally made you leave?" /></div>
          </div>
        </Section>

        <Section title="Avatars and badges">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar className="h-12 w-12"><AvatarFallback>XA</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>RR</AvatarFallback></Avatar>
            <Avatar className="h-8 w-8"><AvatarFallback>DU</AvatarFallback></Avatar>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["UPDATE", "QUIT", "WARNING", "RED_FLAG"] as const).map((t) => {
              const Icon = POST_TYPE_META[t].icon;
              return <Badge key={t} variant={POST_TYPE_META[t].stamp} tilt={t === "QUIT"}><Icon aria-hidden /> {t.replace("_", " ")}</Badge>;
            })}
            <Badge variant="highlight">Unpaid overtime</Badge>
            <Badge>Neutral</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="success">Free for 42 days</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REACTION_TYPES.map((r) => {
              const Icon = REACTION_META[r].icon;
              return (
                <span key={r} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm">
                  <Icon className={`h-4 w-4 ${REACTION_META[r].className}`} aria-hidden /> {r.charAt(0) + r.slice(1).toLowerCase()}
                </span>
              );
            })}
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4"><p className="font-medium">Default card</p><p className="text-sm text-muted-foreground">Hairline border, no shadow.</p></div>
            <div className={`rounded-lg border bg-card p-4 ${POST_TYPE_META.WARNING.card}`}><p className="font-medium">Warning card</p><p className="text-sm text-muted-foreground">Highlighter band on top.</p></div>
            <div className={`rounded-lg border bg-card p-4 ${POST_TYPE_META.RED_FLAG.card}`}><p className="font-medium">Red flag card</p><p className="text-sm text-muted-foreground">Redline bar on the left.</p></div>
          </div>
          <p className="max-w-xl">
            Struck through by the red pen: <span className="redline">Pinecrest Biotech</span>. Reason: <span className="highlighter">unpaid overtime</span>.
          </p>
        </Section>

        <Section title="Empty states">
          <EmptyState icon={DoorOpen} title="That's everyone who walked out today." body="Go outside. Or tell us what you're walking away from." action={<Button variant="outline">Tell your story</Button>} />
        </Section>

        <Section title="Motion">
          <p className="max-w-xl text-sm text-muted-foreground">
            Three purposeful animations only: reaction pop (220ms), post publish slide-in (320ms), chat send (200ms).
            All are disabled when the system asks for reduced motion.
          </p>
        </Section>
      </div>
    </Page>
  );
}
