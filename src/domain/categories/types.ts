export type CategoryId = string;

export interface ExpenseCategory {
  id: CategoryId;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
}
