export const SMM_RUNNING_STATUS = 'Processing';

export function normalizeSmmOrderStatus(value: unknown, fallback = SMM_RUNNING_STATUS) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['completed', 'complete', 'success', '200', 'done'].includes(normalized)) {
    return 'Completed';
  }

  if (['refunded', 'refund', 'partial'].includes(normalized)) {
    return 'Refunded';
  }

  if (['canceled', 'cancelled', 'failed', 'fail', 'error', '-1'].includes(normalized)) {
    return 'Canceled';
  }

  if (['processing', 'in progress', 'in_progress', 'inprogress', 'running', 'active', 'pending', '0', '100'].includes(normalized)) {
    return SMM_RUNNING_STATUS;
  }

  return normalized ? String(value).trim() : fallback;
}
