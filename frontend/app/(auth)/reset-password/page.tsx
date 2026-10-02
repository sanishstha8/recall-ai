"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormError, TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/endpoints";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { applyServerErrors } from "@/lib/validation/server-errors";

type Values = z.infer<typeof resetPasswordSchema>;

function ResetForm() {
  const params = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(resetPasswordSchema) });

  if (!uid || !token) return <FormError message="This reset link is incomplete. Request a new one." />;
  if (done)
    return (
      <div className="space-y-4">
        <CheckCircle2 className="size-8 text-success" />
        <p className="text-sm">Your password has been updated.</p>
        <Button asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );

  const onSubmit = handleSubmit(async ({ new_password }) => {
    setFormError(null);
    try {
      await authApi.confirmPasswordReset({ uid, token, new_password });
      setDone(true);
    } catch (error) {
      const message = applyServerErrors(error, setError, ["new_password"]);
      setFormError(message?.startsWith("token:") ? "This reset link is invalid or has expired." : message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <TextField id="new_password" label="New password" type="password" autoComplete="new-password" error={errors.new_password?.message} {...register("new_password")} />
      <TextField id="confirm" label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
      <Button type="submit" className="h-9 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Update password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      </div>
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
