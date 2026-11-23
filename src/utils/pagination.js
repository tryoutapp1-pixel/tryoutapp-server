/**
 * Pagination helpers shared by every list endpoint.
 * Validators already coerce `page` and `limit` to integers; the defaults here
 * cover requests that omit them.
 */

/**
 * @param {{ page?: number|string, limit?: number|string }} [query]
 * @param {number} [defaultLimit=20]
 * @returns {{ page: number, limit: number, offset: number }}
 */
function toPageArgs({ page = 1, limit } = {}, defaultLimit = 20) {
  const pageNumber = Number(page) || 1;
  const pageSize = Number(limit) || defaultLimit;
  return { page: pageNumber, limit: pageSize, offset: (pageNumber - 1) * pageSize };
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} page
 * @param {number} limit
 * @param {number|string} total
 * @returns {{ items: T[], pagination: { page: number, limit: number, total: number, totalPages: number } }}
 */
function toPageResult(items, page, limit, total) {
  const count = Number(total);
  return { items, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
}

module.exports = { toPageArgs, toPageResult };
