import client from "./client";
import type { ExpenseRead, ExpenseSummary } from "../types";

export const getExpenseSummary = (bikeId: number, year: number, month?: number) =>
  client.get<ExpenseSummary>(`/api/motorcycles/${bikeId}/expense-summary`, {
    params: { year, ...(month != null ? { month } : {}) },
  }).then((r) => r.data);

export const getExpenses = (bikeId: number, year?: number, month?: number) =>
  client.get<ExpenseRead[]>(`/api/motorcycles/${bikeId}/expenses`, {
    params: { ...(year != null ? { year } : {}), ...(month != null ? { month } : {}) },
  }).then((r) => r.data);

export const createExpense = (
  bikeId: number,
  data: { category: string; amount: number; date: string; notes?: string | null },
) =>
  client.post<ExpenseRead>(`/api/motorcycles/${bikeId}/expenses`, data).then((r) => r.data);

export const updateExpense = (
  bikeId: number,
  expenseId: number,
  data: Partial<{ category: string; amount: number; date: string; notes: string | null }>,
) =>
  client.put<ExpenseRead>(`/api/motorcycles/${bikeId}/expenses/${expenseId}`, data).then((r) => r.data);

export const deleteExpense = (bikeId: number, expenseId: number) =>
  client.delete(`/api/motorcycles/${bikeId}/expenses/${expenseId}`);
