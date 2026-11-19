"use client";
import { useEffect, useState } from "react";

const customerChangedEvent = "storefront:customer-changed";
export function notifyCustomerChanged() {
  window.dispatchEvent(new Event(customerChangedEvent));
}

export function useCustomerName() {
  const [name, setName] = useState("");
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = () => {
      const current = ++generation;
      void fetch("/api/account", { cache: "no-store" })
        .then(async (response) => {
          if (response.status === 401 || response.status === 404) return "";
          if (!response.ok) throw new Error();
          const data = await response.json();
          return typeof data.profile?.firstName === "string"
            ? data.profile.firstName.trim()
            : "";
        })
        .then((firstName) => {
          if (active && current === generation) setName(firstName);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener(customerChangedEvent, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener(customerChangedEvent, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return name;
}
