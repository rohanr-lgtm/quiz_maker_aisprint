import { LogoutButton } from "@/app/mcq/logout-button";

export default function McqPage() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Question Bank — Coming Soon</h1>
        <p className="text-muted-foreground">
          The multiple-choice question bank is under construction. Check back
          soon.
        </p>
      </div>
      <LogoutButton />
    </div>
  );
}
