"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { FormError, TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-provider";
import { type RegisterValues, registerSchema } from "@/lib/validation/auth";
import { applyServerErrors } from "@/lib/validation/server-errors";

export default function RegisterPage() {
  const { register: signUp, status } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  const onSubmit = handleSubmit(async ({ confirm: _confirm, ...values }) => {
    setFormError(null);
    try {
      await signUp(values);
      router.replace("/dashboard?welcome=1");
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["email", "password", "first_name", "last_name"]));
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="text-sm text-muted-foreground">Free, private and self-hosted. No AI API keys required.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormError message={formError} />
        <div className="grid grid-cols-2 gap-3">
          <TextField id="first_name" label="First name" autoComplete="given-name" error={errors.first_name?.message} {...register("first_name")} />
          <TextField id="last_name" label="Last name" autoComplete="family-name" error={errors.last_name?.message} {...register("last_name")} />
        </div>
        <TextField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters. Avoid common passwords."
          error={errors.password?.message}
          {...register("password")}
        />
        <TextField id="confirm" label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
        <Button type="submit" className="h-9 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
