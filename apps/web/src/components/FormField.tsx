import { Label } from "@/components/ui/label";
import { translateMessage } from "@/i18n";

export function FormField({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {translateMessage(error)}
        </p>
      )}
    </div>
  );
}
