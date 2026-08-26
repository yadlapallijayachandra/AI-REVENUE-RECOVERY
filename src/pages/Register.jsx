import React, { useState } from "react";
import { Link } from "react-router-dom";
import { localClient } from "@/api/localDataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { toast } from "@/components/ui/use-toast";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState("");
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 10) return setError("Password must be at least 10 characters.");
    setLoading(true);
    try {
      const result = await localClient.auth.register({ fullName, email, password });
      setVerificationUrl(result.developmentVerificationUrl || "");
      setVerificationPending(true);
    } catch (registrationError) {
      setError(registrationError.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      const result = await localClient.auth.resendVerification(email);
      setVerificationUrl(result.developmentVerificationUrl || "");
      toast({ title: "Verification request processed", description: "Check your email provider or local preview." });
    } catch (resendError) {
      setError(resendError.message || "Could not resend verification email.");
    }
  };

  if (verificationPending) {
    return (
      <AuthLayout icon={Mail} title="Verify your email" subtitle="Check your email to verify your RecoverAI account.">
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <p className="text-sm text-muted-foreground mb-5">A verification message was requested for {email}. If email delivery is not configured, the server writes a safe preview to the local outbox.</p>
        {verificationUrl && <a className="block text-sm text-primary underline break-all mb-5" href={verificationUrl}>Open local verification link</a>}
        <p className="text-center text-sm text-muted-foreground mt-4">Didn&apos;t receive it? <button onClick={handleResend} className="text-primary font-medium hover:underline">Resend verification email</button></p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={UserPlus} title="Create your account" subtitle="Set up your merchant recovery workspace." footer={<><span>Already have an account? </span><Link to="/login" className="text-primary font-medium hover:underline">Log in</Link></>}>
      <div className="relative mb-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">or</span></div></div>
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="fullName">Full Name</Label><Input id="fullName" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></div>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-10 h-12" required /></div></div>
        <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" /><Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10 h-12" required /></div></div>
        <div className="space-y-2"><Label htmlFor="confirm">Confirm Password</Label><Input id="confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12" required /></div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : "Create account"}</Button>
      </form>
    </AuthLayout>
  );
}
