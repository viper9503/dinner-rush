import { notFound } from "next/navigation";
import { packageMap, packages } from "@/lib/data";
import { PackageConfigurator } from "./configurator";

export function generateStaticParams() {
  return packages.map((p) => ({ slug: p.slug }));
}

export default async function PackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!packageMap[slug]) notFound();
  return <PackageConfigurator slug={slug} />;
}
