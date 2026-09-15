import { CategoriesTable } from "../../../components/categories/categories-table";
import { DrizzleCategoryRepository } from "../../../server/categories/category-repository";
import { requireSession } from "../../../server/auth/service";

const repository = new DrizzleCategoryRepository();

export default async function CategoriesPage() {
  await requireSession();

  return <CategoriesTable categories={await repository.list()} />;
}
