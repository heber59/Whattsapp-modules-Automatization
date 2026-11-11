import { BusinessArea } from '../business-area';

export default async function BusinessPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return <BusinessArea key={businessId} businessId={businessId} />;
}
