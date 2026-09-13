import { ContentState } from "../ui/content-state";

type ProtectedPlaceholderPageProps = {
  description: string;
  title: string;
};

export function ProtectedPlaceholderPage({
  description,
  title,
}: ProtectedPlaceholderPageProps) {
  return (
    <>
      <header className="page-heading">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <ContentState
        description="This area is being prepared. The workspace navigation is ready, and this workflow will arrive in a future update."
        title={`${title} is coming soon`}
      />
    </>
  );
}
