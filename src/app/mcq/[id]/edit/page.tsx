import { notFound } from "next/navigation";

import { McqForm } from "@/components/mcq-form";
import { getMcqById } from "@/lib/services/mcq-service";

type EditMcqPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditMcqPage({ params }: EditMcqPageProps) {
  const { id } = await params;
  const mcq = await getMcqById(id);

  if (!mcq) {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col p-6">
      <McqForm
        mode="edit"
        mcqId={mcq.id}
        initialValues={{
          name: mcq.name,
          question: mcq.question,
          choices: mcq.choices
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((choice) => ({
              text: choice.text,
              isCorrect: choice.isCorrect,
            })),
        }}
      />
    </div>
  );
}
