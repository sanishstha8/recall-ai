"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { FormError, TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-provider";
import { type LoginValues, loginSchema } from "@/lib/validation/auth";
import { applyServerErrors } from "@/lib/validation/server-errors";

function safeNext(next: string | null) {
  // Only allow same-origin relative paths (prevents open redirects).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.replace(next);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["email", "password"]));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        autoFocus
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        labelAction={
          <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
        }
        {...register("password")}
      />
      <Button type="submit" className="h-9 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your private knowledge workspace.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground">
        New to RecallAI?{" "}
        <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
