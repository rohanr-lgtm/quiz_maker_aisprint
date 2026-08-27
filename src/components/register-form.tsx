"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = "Something went wrong. Please try again.";

type FieldName =
  | "firstName"
  | "lastName"
  | "username"
  | "email"
  | "password"
  | "confirmPassword";

type Values = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;

const initialValues: Values = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.firstName.trim()) errors.firstName = "First name is required";
  if (!values.lastName.trim()) errors.lastName = "Last name is required";
  if (!values.username.trim()) errors.username = "Username is required";
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Enter a valid email address";
  }
  if (values.password.length < 8) {
    errors.password = "Must be at least 8 characters long";
  }
  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match";
  }
  return errors;
}

export function RegisterForm({ ...props }: React.ComponentProps<typeof Card>) {
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          username: values.username.trim(),
          email: values.email.trim(),
          passwordHash,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
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

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={fieldErrors.firstName ? true : undefined}>
              <FieldLabel htmlFor="firstName">First Name</FieldLabel>
              <Input
                id="firstName"
                type="text"
                placeholder="Ada"
                value={values.firstName}
                onChange={updateField("firstName")}
              />
              <FieldError
                errors={
                  fieldErrors.firstName
                    ? [{ message: fieldErrors.firstName }]
                    : undefined
                }
              />
            </Field>
            <Field data-invalid={fieldErrors.lastName ? true : undefined}>
              <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
              <Input
                id="lastName"
                type="text"
                placeholder="Lovelace"
                value={values.lastName}
                onChange={updateField("lastName")}
              />
              <FieldError
                errors={
                  fieldErrors.lastName
                    ? [{ message: fieldErrors.lastName }]
                    : undefined
                }
              />
            </Field>
            <Field data-invalid={fieldErrors.username ? true : undefined}>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                type="text"
                placeholder="alovelace"
                value={values.username}
                onChange={updateField("username")}
              />
              <FieldError
                errors={
                  fieldErrors.username
                    ? [{ message: fieldErrors.username }]
                    : undefined
                }
              />
            </Field>
            <Field data-invalid={fieldErrors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={values.email}
                onChange={updateField("email")}
              />
              <FieldDescription>
                We&apos;ll use this to contact you. We will not share your
                email with anyone else.
              </FieldDescription>
              <FieldError
                errors={
                  fieldErrors.email ? [{ message: fieldErrors.email }] : undefined
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
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
              <FieldError
                errors={
                  fieldErrors.password
                    ? [{ message: fieldErrors.password }]
                    : undefined
                }
              />
            </Field>
            <Field data-invalid={fieldErrors.confirmPassword ? true : undefined}>
              <FieldLabel htmlFor="confirmPassword">
                Confirm Password
              </FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                value={values.confirmPassword}
                onChange={updateField("confirmPassword")}
              />
              <FieldDescription>Please confirm your password.</FieldDescription>
              <FieldError
                errors={
                  fieldErrors.confirmPassword
                    ? [{ message: fieldErrors.confirmPassword }]
                    : undefined
                }
              />
            </Field>
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account…" : "Create Account"}
                </Button>
                <FieldError
                  errors={formError ? [{ message: formError }] : undefined}
                />
                <FieldDescription className="px-6 text-center">
                  Already have an account? <Link href="/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
