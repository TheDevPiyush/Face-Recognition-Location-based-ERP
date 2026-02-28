"use client";

import { useEffect } from "react";
import { getAccessToken } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = getAccessToken();
    router.replace(token ? "/dashboard" : "/login");
  }, [router]);
  return null;
}
