import { FullPreview } from "@/components/full-preview";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FullPreview projectId={id} />;
}
