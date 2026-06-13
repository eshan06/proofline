"use client";

import { useParams } from "next/navigation";
import { CustomersView } from "@/components/customers/customers-view";

export default function CustomersPage() {
  const params = useParams<{ customerId?: string[] }>();
  return <CustomersView customerId={params.customerId?.[0]} />;
}
