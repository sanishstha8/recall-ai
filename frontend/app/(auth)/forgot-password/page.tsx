"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormError, TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/endpoints";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });

  return (
    <div className="space-y-6">
      <Link
        href="/login"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      {sent ? (
        <div className="space-y-3">
          <MailCheck className="size-8 text-brand" />
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, we&apos;ve sent a reset link. In local development the email is printed
            to the backend console.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
          </div>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormError message={formError} />
            <TextField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Button type="submit" className="h-9 w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Send reset link
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
