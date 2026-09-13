import { ProtectedPlaceholderPage } from "../../../components/layout/protected-placeholder-page";
import { requireSession } from "../../../server/auth/service";

export default async function CategoriesPage() {
  await requireSession();

  return (
    <ProtectedPlaceholderPage
      description="Expense category configuration will be available here."
      title="Categories"
    />
  );
}
