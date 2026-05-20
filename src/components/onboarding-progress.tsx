import {
  ONBOARDING_STEPS,
  STEP_LABELS,
  type OnboardingStep,
  stepIndex,
} from "@/lib/onboarding";

// Static step progress strip — renders the seven-step indicator with the
// current step highlighted. Each step page passes its own step in so we
// don't need any client-side path detection.
export function OnboardingProgress({ step }: { step: OnboardingStep }) {
  const currentIndex = stepIndex(step);
  return (
    <ol className="flex items-center gap-1 sm:gap-2 mb-6 overflow-x-auto" aria-label="Setup progress">
      {ONBOARDING_STEPS.map((s, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <li key={s} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <span
              className={
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold " +
                (isDone
                  ? "bg-brand-600 text-white"
                  : isCurrent
                  ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600"
                  : "bg-gray-200 text-gray-500")
              }
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span
              className={
                "text-xs sm:text-sm hidden sm:inline " +
                (isCurrent ? "font-semibold text-gray-900" : "text-gray-500")
              }
            >
              {STEP_LABELS[s]}
            </span>
            {i < ONBOARDING_STEPS.length - 1 && (
              <span className="w-3 sm:w-6 h-px bg-gray-300" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function WizardCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 sm:p-8 shadow-sm">
      {children}
    </div>
  );
}
