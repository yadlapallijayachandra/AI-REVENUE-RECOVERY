import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import { localClient } from "@/api/localDataClient";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, message: "", error: "" });

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState({ loading: false, message: "", error: "This verification link is invalid or expired." });
      return;
    }
    localClient.auth.verifyEmail(token)
      .then((result) => setState({ loading: false, message: result.message, error: "" }))
      .catch((error) => setState({ loading: false, message: "", error: error.message }));
  }, [params]);

  if (state.loading) return <AuthLayout icon={Loader2} title="Verifying your email" subtitle="Checking your secure verification link."><div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AuthLayout>;
  if (state.error) return <AuthLayout icon={ShieldAlert} title="Verification failed" subtitle={state.error}><Link to="/register"><Button className="w-full">Return to registration</Button></Link></AuthLayout>;
  return <AuthLayout icon={CheckCircle2} title="Email verified" subtitle={state.message}><Link to="/login"><Button className="w-full">Continue to sign in</Button></Link></AuthLayout>;
}
