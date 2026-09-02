"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getCurrentUser } from "@/lib/client-identity";

const MIN_CHOICES = 2;
const MAX_CHOICES = 6;
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_LOGGED_IN_ERROR = "Please log in again.";

export type McqFormChoice = {
  text: string;
  isCorrect: boolean;
};

export type McqFormValues = {
  name: string;
  question: string;
  choices: McqFormChoice[];
};

type FormErrors = {
  name?: string;
  question?: string;
  choices?: string;
};

function defaultChoices(): McqFormChoice[] {
  return [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ];
}

function validate(values: McqFormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) {
    errors.name = "Name is required";
  }
  if (!values.question.trim()) {
    errors.question = "Question is required";
  }

  if (values.choices.some((choice) => !choice.text.trim())) {
    errors.choices = "Every choice must have text";
  } else if (values.choices.filter((choice) => choice.isCorrect).length !== 1) {
    errors.choices = "Mark exactly one choice as correct";
  }

  return errors;
}

export type McqFormProps = {
  mode: "create" | "edit";
  mcqId?: string;
  initialValues?: McqFormValues;
};

export function McqForm({ mode, mcqId, initialValues }: McqFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<McqFormValues>(
    initialValues ?? { name: "", question: "", choices: defaultChoices() }
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateName(event: ChangeEvent<HTMLInputElement>) {
    setValues((prev) => ({ ...prev, name: event.target.value }));
  }

  function updateQuestion(event: ChangeEvent<HTMLTextAreaElement>) {
    setValues((prev) => ({ ...prev, question: event.target.value }));
  }

  function updateChoiceText(index: number) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({
        ...prev,
        choices: prev.choices.map((choice, choiceIndex) =>
          choiceIndex === index
            ? { ...choice, text: event.target.value }
            : choice
        ),
      }));
    };
  }

  function setCorrectChoice(value: unknown) {
    const correctIndex = Number(value);
    setValues((prev) => ({
      ...prev,
      choices: prev.choices.map((choice, index) => ({
        ...choice,
        isCorrect: index === correctIndex,
      })),
    }));
  }

  function addChoice() {
    setValues((prev) =>
      prev.choices.length >= MAX_CHOICES
        ? prev
        : {
            ...prev,
            choices: [...prev.choices, { text: "", isCorrect: false }],
          }
    );
  }

  function removeChoice(index: number) {
    setValues((prev) =>
      prev.choices.length <= MIN_CHOICES
        ? prev
        : {
            ...prev,
            choices: prev.choices.filter(
              (_choice, choiceIndex) => choiceIndex !== index
            ),
          }
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
      setFormError(NOT_LOGGED_IN_ERROR);
      return;
    }

    const choices = values.choices.map((choice) => ({
      text: choice.text.trim(),
      isCorrect: choice.isCorrect,
    }));

    const body =
      mode === "create"
        ? {
            name: values.name.trim(),
            question: values.question.trim(),
            createdBy: currentUser.id,
            choices,
          }
        : {
            name: values.name.trim(),
            question: values.question.trim(),
            choices,
          };

    setIsSubmitting(true);
    try {
      const response = await fetch(
        mode === "create" ? "/api/mcqs" : `/api/mcqs/${mcqId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setFormError(data?.error ?? GENERIC_ERROR);
        return;
      }

      router.push("/mcq");
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  const correctIndex = values.choices.findIndex((choice) => choice.isCorrect);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Create Question" : "Edit Question"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor="mcq-name">Name</FieldLabel>
              <Input id="mcq-name" value={values.name} onChange={updateName} />
              <FieldError
                errors={errors.name ? [{ message: errors.name }] : undefined}
              />
            </Field>

            <Field data-invalid={errors.question ? true : undefined}>
              <FieldLabel htmlFor="mcq-question">Question</FieldLabel>
              <Textarea
                id="mcq-question"
                value={values.question}
                onChange={updateQuestion}
              />
              <FieldError
                errors={
                  errors.question ? [{ message: errors.question }] : undefined
                }
              />
            </Field>

            <Field data-invalid={errors.choices ? true : undefined}>
              <FieldLabel>Choices</FieldLabel>
              <RadioGroup
                value={correctIndex >= 0 ? String(correctIndex) : undefined}
                onValueChange={setCorrectChoice}
              >
                {values.choices.map((choice, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={String(index)}
                      aria-label={`Mark choice ${index + 1} as correct`}
                    />
                    <Input
                      value={choice.text}
                      onChange={updateChoiceText(index)}
                      placeholder={`Choice ${index + 1}`}
                      aria-label={`Choice ${index + 1} text`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeChoice(index)}
                      disabled={values.choices.length <= MIN_CHOICES}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </RadioGroup>
              <FieldError
                errors={
                  errors.choices ? [{ message: errors.choices }] : undefined
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addChoice}
                disabled={values.choices.length >= MAX_CHOICES}
              >
                Add choice
              </Button>
            </Field>

            <Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/mcq")}
                >
                  Cancel
                </Button>
              </div>
              <FieldError
                errors={formError ? [{ message: formError }] : undefined}
              />
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
