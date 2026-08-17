"use client";

import { usePathname } from "next/navigation";
import Header from "./govuk/Header";
import ServiceNavigation, { type NavItem } from "./govuk/ServiceNavigation";
import { branding } from "@/lib/branding";
import { PUBLIC_NAV } from "@/lib/nav";

export default function SiteHeader() {
  const pathname = usePathname();

  const navigation: NavItem[] = PUBLIC_NAV.map((item) => ({
    href: item.href,
    text: item.text,
    current: pathname === item.href,
    active: !item.exact && pathname.startsWith(item.href),
  }));

  return (
    <>
      <Header homepageUrl="/" organisationName={branding.organisationName} />
      <ServiceNavigation
        serviceName={branding.serviceName}
        serviceUrl="/"
        navigation={navigation}
      />
    </>
  );
}
