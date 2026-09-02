"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { hashPasswordForTransit } from "@/lib/crypto/client-hash";
import { saveCurrentUser, type CurrentUser } from "@/lib/client-identity";

const GENERIC_ERROR = "Invalid username/email or password";

type FieldName = "identifier" | "password";
type Values = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;

const initialValues: Values = { identifier: "", password: "" };

function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.identifier.trim()) {
    errors.identifier = "Username or email is required";
  }
  if (!values.password) {
    errors.password = "Password is required";
  }
  return errors;
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: FieldName) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const passwordHash = await hashPasswordForTransit(values.password);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: values.identifier.trim(),
          passwordHash,
        }),
      });

      if (!response.ok) {
        setFormError(GENERIC_ERROR);
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | { user?: CurrentUser }
        | null;
      if (data?.user) {
        saveCurrentUser(data.user);
      }

      router.push("/mcq");
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your username or email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={fieldErrors.identifier ? true : undefined}>
                <FieldLabel htmlFor="identifier">Username or Email</FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="m@example.com"
                  value={values.identifier}
                  onChange={updateField("identifier")}
                />
                <FieldError
                  errors={
                    fieldErrors.identifier
                      ? [{ message: fieldErrors.identifier }]
                      : undefined
                  }
                />
              </Field>
              <Field data-invalid={fieldErrors.password ? true : undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={values.password}
                  onChange={updateField("password")}
                />
                <FieldError
                  errors={
                    fieldErrors.password
                      ? [{ message: fieldErrors.password }]
                      : undefined
                  }
                />
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Logging in…" : "Login"}
                </Button>
                <FieldError
                  errors={formError ? [{ message: formError }] : undefined}
                />
                <FieldDescription className="text-center">
                  Don&apos;t have an account? <Link href="/register">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
