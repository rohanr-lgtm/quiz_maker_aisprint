import { notFound } from "next/navigation";

import { McqPreview } from "@/components/mcq-preview";
import { getMcqById } from "@/lib/services/mcq-service";

type PreviewMcqPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PreviewMcqPage({
  params,
}: PreviewMcqPageProps) {
  const { id } = await params;
  const mcq = await getMcqById(id);

  if (!mcq) {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col p-6">
      <McqPreview mcqId={mcq.id} question={mcq.question} choices={mcq.choices} />
    </div>
  );
}
