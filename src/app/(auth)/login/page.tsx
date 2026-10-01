"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowRight, Calculator, FileCheck2, FileText, Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Ongeldig e-mailadres of wachtwoord");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Inloggen lukt nu niet. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <div className="grid w-full max-w-[960px] gap-10 lg:grid-cols-[1fr_380px] lg:gap-20">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-medium text-muted-foreground">WebsUp & Koolhaas Installaties</p>
          <div className="overflow-hidden pb-2"><h1 className="workspace-title mt-4 max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Van calculatie naar akkoord.</h1></div>
          <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">Je werkplek voor calculaties, offertes, klanten en projecten.</p>
          <div className="mt-8 flex items-center gap-3" aria-label="Calculatie, conceptofferte, klantakkoord">
            {[Calculator, FileText, FileCheck2].map((Icon, index) => <div key={index} className="flex items-center gap-3">
              {index > 0 && <ArrowRight className="size-4 text-muted-foreground" />}
              <span className="grid size-11 place-items-center rounded-lg border border-border bg-card"><Icon className="size-5 text-foreground" /></span>
            </div>)}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Welkom terug</CardTitle>
            <CardDescription>Log in op je werkplek.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  placeholder="je@email.nl"
                  {...register("email")}
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && (
                  <p id="password-error" className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Inloggen
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
