import { CatalogDetail } from "@/components/catalog-detail";
export default async function CatalogDetailPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <CatalogDetail slug={slug} />; }
