import { McqForm } from "@/components/mcq-form";

export default function NewMcqPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col p-6">
      <McqForm mode="create" />
    </div>
  );
}
