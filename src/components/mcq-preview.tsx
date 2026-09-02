"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getCurrentUser } from "@/lib/client-identity";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_LOGGED_IN_ERROR = "Please log in again.";

export type McqPreviewChoice = {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
};

export type McqPreviewProps = {
  mcqId: string;
  question: string;
  choices: McqPreviewChoice[];
};

type AttemptResult = {
  isCorrect: boolean;
};

export function McqPreview({ mcqId, question, choices }: McqPreviewProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(
    null
  );
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedChoices = [...choices].sort((a, b) => a.position - b.position);
  const correctChoice = choices.find((choice) => choice.isCorrect);

  function handleSelect(value: unknown) {
    setSelectedChoiceId(String(value));
  }

  async function handleSubmit() {
    if (!selectedChoiceId) {
      return;
    }
    setFormError(null);

    const currentUser = getCurrentUser();
    if (!currentUser) {
      setFormError(NOT_LOGGED_IN_ERROR);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/mcqs/${mcqId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choiceId: selectedChoiceId,
          attemptedBy: currentUser.id,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        attempt?: AttemptResult;
        error?: string;
      } | null;

      if (!response.ok) {
        setFormError(data?.error ?? GENERIC_ERROR);
        return;
      }

      if (data?.attempt) {
        setResult({ isCorrect: data.attempt.isCorrect });
      }
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{question}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-5">
          <Field>
            <RadioGroup
              value={selectedChoiceId ?? ""}
              onValueChange={handleSelect}
              disabled={!!result}
            >
              {sortedChoices.map((choice) => (
                <div key={choice.id} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={choice.id}
                    aria-label={choice.text}
                  />
                  <span>{choice.text}</span>
                </div>
              ))}
            </RadioGroup>
          </Field>

          {result && (
            <p role="status">
              {result.isCorrect
                ? "Correct!"
                : `Incorrect — the correct answer was: ${correctChoice?.text ?? ""}`}
            </p>
          )}

          <Field>
            <div className="flex gap-2">
              {!result && (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedChoiceId || isSubmitting}
                >
                  {isSubmitting ? "Submitting…" : "Submit Answer"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<Link href="/mcq" />}
              >
                Back to Questions
              </Button>
            </div>
            <FieldError
              errors={formError ? [{ message: formError }] : undefined}
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
