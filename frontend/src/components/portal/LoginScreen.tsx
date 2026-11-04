import { LandingHome } from "@/components/landing/LandingHome";
import { LandingFooter, LandingShell } from "@/components/landing/LandingChrome";
import type { Health } from "@/lib/types";

/** The signed-out homepage: hero, the feature chapters, then sign-in. The
 *  design controls are a portal feature, so they are not shown here. */
export function LoginScreen({
  health,
  healthPending,
  notice,
  signingIn,
  onGuest,
}: {
  health: Health | undefined;
  healthPending: boolean;
  notice: string | null;
  signingIn: boolean;
  onGuest: (input: { displayName?: string; turnstileToken?: string }) => Promise<boolean>;
  designControls?: React.ReactNode;
  isDark?: boolean;
}) {
  return (
    <LandingShell testId="login-screen">
      <LandingHome
        health={health}
        healthPending={healthPending}
        notice={notice}
        signingIn={signingIn}
        onGuest={onGuest}
        isDark={false}
      />
      <LandingFooter health={health} />
    </LandingShell>
  );
}
