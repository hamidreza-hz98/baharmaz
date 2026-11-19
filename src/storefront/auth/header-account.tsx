"use client";
import Link from "next/link";
import { Button } from "@mui/material";
import { CustomerAuthDialog } from "./customer-auth-dialog";
import { useCustomerName } from "./customer-name";

export function HeaderAccount() {
  const name = useCustomerName();
  return name ? (
    <Button component={Link} href="/account" variant="outlined">
      {name}
    </Button>
  ) : (
    <CustomerAuthDialog />
  );
}
