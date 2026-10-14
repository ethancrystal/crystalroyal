export function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatNumber(amount: number): string {
  return Math.round(amount).toLocaleString("en-US");
}
