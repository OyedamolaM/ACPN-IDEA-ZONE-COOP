import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PasswordField({
  id,
  label,
  error,
  ...props
}: ComponentProps<typeof Input> & { id: string; label: string; error?: string | undefined }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <Input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : props["aria-describedby"]}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="auth-error">
          {error}
        </p>
      )}
    </div>
  );
}
