import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  setCategoryActiveAction,
  updateCategoryAction,
} from "./actions";
import { DrizzleCategoryRepository } from "../../../server/categories/category-repository";
import { requireSession } from "../../../server/auth/service";

const repository = new DrizzleCategoryRepository();

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? error : null;
  const categories = await repository.list();

  return (
    <div className="page">
      <h1 className="page-heading">Categories</h1>

      {errorMessage && <p className="form-error">{errorMessage}</p>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Name / description</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category, index) => (
            <tr key={category.id}>
              <td>
                <form action={moveCategoryAction.bind(null, category.id, "up")}>
                  <button
                    className="button button--secondary"
                    disabled={index === 0}
                    type="submit"
                  >
                    ↑
                  </button>
                </form>
                <form
                  action={moveCategoryAction.bind(null, category.id, "down")}
                >
                  <button
                    className="button button--secondary"
                    disabled={index === categories.length - 1}
                    type="submit"
                  >
                    ↓
                  </button>
                </form>
              </td>
              <td>
                <form
                  action={updateCategoryAction.bind(null, category.id)}
                  className="category-edit-form"
                >
                  <input
                    className="form-control"
                    defaultValue={category.name}
                    maxLength={120}
                    name="name"
                    required
                  />
                  <input
                    className="form-control"
                    defaultValue={category.description ?? ""}
                    name="description"
                    placeholder="Description"
                  />
                  <button className="button button--primary" type="submit">
                    Save
                  </button>
                </form>
              </td>
              <td>{category.active ? "Active" : "Inactive"}</td>
              <td>
                <form
                  action={setCategoryActiveAction.bind(
                    null,
                    category.id,
                    !category.active,
                  )}
                >
                  <button className="button button--secondary" type="submit">
                    {category.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <form action={deleteCategoryAction.bind(null, category.id)}>
                  <button className="button button--secondary" type="submit">
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan={4}>No categories yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Add category</h2>
      <form action={createCategoryAction} className="category-edit-form">
        <input
          className="form-control"
          maxLength={120}
          name="name"
          placeholder="Name"
          required
        />
        <input
          className="form-control"
          name="description"
          placeholder="Description"
        />
        <button className="button button--primary" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}
