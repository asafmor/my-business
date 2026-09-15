import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("../src/server/db/schema", () => ({
  categories: {
    id: "categories.id",
    name: "categories.name",
    sortOrder: "categories.sort_order",
  },
}));

import { DrizzleCategoryRepository } from "../src/server/categories/category-repository";

function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const method of [
    "from",
    "where",
    "orderBy",
    "values",
    "set",
    "returning",
    "for",
  ]) {
    obj[method] = vi.fn(() => obj);
  }
  (obj as { then: (resolve: (value: unknown) => void) => void }).then = (
    resolve,
  ) => resolve(result);
  return obj as {
    set: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
  };
}

const categoryId = "de305d54-75b4-431b-adb2-eb6b9e546013";

describe("DrizzleCategoryRepository.create", () => {
  it("assigns the next sortOrder and returns the created category", async () => {
    const selectChain = chain([{ max: 2 }]);
    const insertChain = chain([
      {
        active: true,
        description: null,
        id: categoryId,
        name: "Fuel",
        sortOrder: 3,
      },
    ]);
    const database = {
      insert: vi.fn(() => insertChain),
      select: vi.fn(() => selectChain),
    };
    const repository = new DrizzleCategoryRepository((() => database) as never);

    const result = await repository.create({ description: null, name: "Fuel" });

    expect(result).toEqual({
      ok: true,
      category: expect.objectContaining({ name: "Fuel", sortOrder: 3 }),
    });
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Fuel", sortOrder: 3 }),
    );
  });

  it("reports a duplicate name instead of throwing", async () => {
    const selectChain = chain([{ max: -1 }]);
    const database = {
      insert: vi.fn(() => {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }),
      select: vi.fn(() => selectChain),
    };
    const repository = new DrizzleCategoryRepository((() => database) as never);

    await expect(
      repository.create({ description: null, name: "Fuel" }),
    ).resolves.toEqual({
      ok: false,
      reason: "DUPLICATE_NAME",
    });
  });
});

describe("DrizzleCategoryRepository.remove", () => {
  it("maps a foreign-key violation to IN_USE instead of throwing", async () => {
    const database = {
      delete: vi.fn(() => {
        throw Object.assign(new Error("violates foreign key constraint"), {
          code: "23503",
        });
      }),
    };
    const repository = new DrizzleCategoryRepository((() => database) as never);

    await expect(repository.remove([categoryId])).resolves.toBe("IN_USE");
  });

  it("deletes an unreferenced category", async () => {
    const deleteChain = chain([{ id: categoryId }]);
    const database = { delete: vi.fn(() => deleteChain) };
    const repository = new DrizzleCategoryRepository((() => database) as never);

    await expect(repository.remove([categoryId])).resolves.toBe("DELETED");
  });
});

describe("DrizzleCategoryRepository.reorder", () => {
  it("writes the handed-back order straight into sortOrder", async () => {
    const updateChain = chain(undefined);
    const transaction = { update: vi.fn(() => updateChain) };
    const database = {
      transaction: vi.fn(async (callback) => callback(transaction)),
    };
    const repository = new DrizzleCategoryRepository((() => database) as never);

    await repository.reorder(["c", "a", "b"]);

    expect(updateChain.set).toHaveBeenNthCalledWith(1, { sortOrder: 0 });
    expect(updateChain.set).toHaveBeenNthCalledWith(2, { sortOrder: 1 });
    expect(updateChain.set).toHaveBeenNthCalledWith(3, { sortOrder: 2 });
  });

  it("does not open a transaction for an empty order", async () => {
    const database = { transaction: vi.fn() };
    const repository = new DrizzleCategoryRepository((() => database) as never);

    await repository.reorder([]);

    expect(database.transaction).not.toHaveBeenCalled();
  });
});

describe("DrizzleCategoryRepository.setActive", () => {
  it("updates every id in one statement and counts the rows", async () => {
    const updateChain = chain([{ id: "a" }, { id: "b" }]);
    const database = { update: vi.fn(() => updateChain) };
    const repository = new DrizzleCategoryRepository((() => database) as never);

    await expect(repository.setActive(["a", "b"], false)).resolves.toBe(2);
    expect(updateChain.set).toHaveBeenCalledWith({ active: false });
  });
});
